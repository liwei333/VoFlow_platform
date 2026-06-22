#!/usr/bin/env python3
"""Local avatar photo detector service backed by macOS Vision.

This script is intentionally outside the Next.js route layer. It exposes the
HTTP contract consumed by src/lib/avatar/detector.ts:

  GET  /health
  POST /detect-face
"""

from __future__ import annotations

import argparse
import base64
import json
import math
from dataclasses import dataclass
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from io import BytesIO
from typing import Any

from PIL import Image, ImageStat

try:
    import Foundation
    import Vision
except Exception as exc:  # pragma: no cover - exercised by runtime health.
    Foundation = None
    Vision = None
    VISION_IMPORT_ERROR = exc
else:
    VISION_IMPORT_ERROR = None


@dataclass(frozen=True)
class FaceObservation:
    confidence: float
    face_box_ratio: float
    bbox: tuple[float, float, float, float]
    yaw: float
    pitch: float
    roll: float


def classify_exposure(
    average_luminance: float,
    bright_ratio: float = 0,
    dark_ratio: float = 0,
) -> str:
    if bright_ratio >= 0.35 or average_luminance >= 225:
        return "overexposed"
    if dark_ratio >= 0.45 or average_luminance <= 35:
        return "underexposed"
    return "normal"


def estimate_blur_score(pixel_rows: list[list[int]]) -> float:
    if len(pixel_rows) < 3 or len(pixel_rows[0]) < 3:
        return 0

    values: list[float] = []
    for y in range(1, len(pixel_rows) - 1):
        row = pixel_rows[y]
        for x in range(1, len(row) - 1):
            laplacian = (
                -4 * row[x]
                + pixel_rows[y - 1][x]
                + pixel_rows[y + 1][x]
                + row[x - 1]
                + row[x + 1]
            )
            values.append(float(laplacian))

    if not values:
        return 0

    mean = sum(values) / len(values)
    variance = sum((value - mean) ** 2 for value in values) / len(values)
    return round(variance, 2)


def build_detection_response(
    *,
    face_count: int,
    yaw: float,
    pitch: float,
    roll: float,
    blur_score: float,
    occlusion: str,
    exposure: str,
    face_box_ratio: float | None = None,
    confidence: float | None = None,
) -> dict[str, Any]:
    response: dict[str, Any] = {
        "faceCount": face_count,
        "yaw": round(yaw, 2),
        "pitch": round(pitch, 2),
        "roll": round(roll, 2),
        "blurScore": round(blur_score, 2),
        "occlusion": occlusion,
        "exposure": exposure,
    }
    if face_box_ratio is not None:
        response["faceBoxRatio"] = round(face_box_ratio, 4)
    if confidence is not None:
        response["confidence"] = round(confidence, 4)
    return response


def analyze_image(image_bytes: bytes) -> dict[str, Any]:
    image = Image.open(BytesIO(image_bytes)).convert("RGB")
    faces = detect_faces_with_vision(image_bytes)
    primary_face = max(faces, key=lambda face: face.confidence, default=None)
    analysis_image = crop_face(image, primary_face) if primary_face else image

    grayscale = analysis_image.convert("L")
    grayscale.thumbnail((256, 256))
    pixel_rows = [list(grayscale.crop((0, y, grayscale.width, y + 1)).getdata()) for y in range(grayscale.height)]
    blur_score = estimate_blur_score(pixel_rows)
    exposure = estimate_exposure(analysis_image)

    return build_detection_response(
        face_count=len(faces),
        yaw=primary_face.yaw if primary_face else 0,
        pitch=primary_face.pitch if primary_face else 0,
        roll=primary_face.roll if primary_face else 0,
        blur_score=blur_score,
        occlusion="none",
        exposure=exposure,
        face_box_ratio=primary_face.face_box_ratio if primary_face else None,
        confidence=primary_face.confidence if primary_face else None,
    )


def detect_faces_with_vision(image_bytes: bytes) -> list[FaceObservation]:
    if VISION_IMPORT_ERROR is not None:
        raise RuntimeError(f"macOS Vision is unavailable: {VISION_IMPORT_ERROR}")

    data = Foundation.NSData.dataWithBytes_length_(image_bytes, len(image_bytes))
    handler = Vision.VNImageRequestHandler.alloc().initWithData_options_(data, None)
    request = Vision.VNDetectFaceRectanglesRequest.alloc().init()
    ok, error = handler.performRequests_error_([request], None)
    if not ok:
        raise RuntimeError(f"Vision face detection failed: {error}")

    observations: list[FaceObservation] = []
    for result in request.results() or []:
        bbox = result.boundingBox()
        width = float(bbox.size.width)
        height = float(bbox.size.height)
        observations.append(
            FaceObservation(
                confidence=float(result.confidence()),
                face_box_ratio=width * height,
                bbox=(float(bbox.origin.x), float(bbox.origin.y), width, height),
                yaw=to_degrees(result.yaw()),
                pitch=to_degrees(result.pitch()),
                roll=to_degrees(result.roll()),
            )
        )
    return observations


def crop_face(image: Image.Image, face: FaceObservation) -> Image.Image:
    image_width, image_height = image.size
    x, y, width, height = face.bbox
    left = max(0, int(x * image_width))
    top = max(0, int((1 - y - height) * image_height))
    right = min(image_width, int((x + width) * image_width))
    bottom = min(image_height, int((1 - y) * image_height))
    if right <= left or bottom <= top:
        return image
    return image.crop((left, top, right, bottom))


def estimate_exposure(image: Image.Image) -> str:
    grayscale = image.convert("L")
    stat = ImageStat.Stat(grayscale)
    average_luminance = float(stat.mean[0])
    histogram = grayscale.histogram()
    total_pixels = max(1, sum(histogram))
    dark_ratio = sum(histogram[:30]) / total_pixels
    bright_ratio = sum(histogram[235:]) / total_pixels
    return classify_exposure(average_luminance, bright_ratio, dark_ratio)


def to_degrees(value: Any) -> float:
    try:
        radians = float(value)
    except (TypeError, ValueError):
        return 0
    if not math.isfinite(radians):
        return 0
    return radians * 180 / math.pi


class DetectorRequestHandler(BaseHTTPRequestHandler):
    server_version = "VoFlowAvatarPhotoDetector/1.0"

    def do_GET(self) -> None:
        if self.path != "/health":
            self.send_json(404, {"error": "not_found"})
            return

        if VISION_IMPORT_ERROR is not None:
            self.send_json(503, {"status": "offline", "error": str(VISION_IMPORT_ERROR)})
            return

        self.send_json(200, {"status": "ok", "provider": "macos-vision"})

    def do_POST(self) -> None:
        if self.path != "/detect-face":
            self.send_json(404, {"error": "not_found"})
            return

        try:
            content_length = int(self.headers.get("Content-Length", "0"))
            payload = json.loads(self.rfile.read(content_length).decode("utf-8"))
            image_base64 = payload.get("imageBase64")
            if not isinstance(image_base64, str) or not image_base64:
                self.send_json(400, {"error": "imageBase64 is required"})
                return

            image_bytes = base64.b64decode(image_base64, validate=True)
            self.send_json(200, analyze_image(image_bytes))
        except Exception as exc:
            self.send_json(500, {"error": str(exc)})

    def log_message(self, format: str, *args: Any) -> None:
        return

    def send_json(self, status: int, payload: dict[str, Any]) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=7010)
    args = parser.parse_args()

    server = ThreadingHTTPServer((args.host, args.port), DetectorRequestHandler)
    print(f"local avatar photo detector listening on http://{args.host}:{args.port}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
