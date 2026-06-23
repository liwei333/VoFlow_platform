import importlib.util
import pathlib
import sys
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[1]
MODULE_PATH = ROOT / "scripts" / "local_avatar_photo_detector.py"

spec = importlib.util.spec_from_file_location("local_avatar_photo_detector", MODULE_PATH)
detector = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = detector
spec.loader.exec_module(detector)


class LocalAvatarPhotoDetectorTest(unittest.TestCase):
    def test_classifies_exposure_from_average_luminance(self):
        self.assertEqual(detector.classify_exposure(18), "underexposed")
        self.assertEqual(detector.classify_exposure(128), "normal")
        self.assertEqual(detector.classify_exposure(128, bright_ratio=0.06), "overexposed")
        self.assertEqual(detector.classify_exposure(238), "overexposed")

    def test_estimates_blur_score_from_laplacian_variance(self):
        flat_pixels = [[120 for _ in range(8)] for _ in range(8)]
        edge_pixels = [
            [0, 0, 0, 0, 255, 255, 255, 255],
            [0, 0, 0, 0, 255, 255, 255, 255],
            [0, 0, 0, 0, 255, 255, 255, 255],
            [0, 0, 0, 0, 255, 255, 255, 255],
            [255, 255, 255, 255, 0, 0, 0, 0],
            [255, 255, 255, 255, 0, 0, 0, 0],
            [255, 255, 255, 255, 0, 0, 0, 0],
            [255, 255, 255, 255, 0, 0, 0, 0],
        ]

        self.assertEqual(detector.estimate_blur_score(flat_pixels), 0)
        self.assertGreater(detector.estimate_blur_score(edge_pixels), 100)

    def test_build_detection_response_uses_contract_fields(self):
        response = detector.build_detection_response(
            face_count=2,
            yaw=12.4,
            pitch=-2.5,
            roll=1.5,
            blur_score=155.2,
            occlusion="none",
            exposure="normal",
            face_box_ratio=0.31,
            confidence=0.82,
        )

        self.assertEqual(
            set(response),
            {
                "faceCount",
                "yaw",
                "pitch",
                "roll",
                "blurScore",
                "occlusion",
                "exposure",
                "faceBoxRatio",
                "confidence",
            },
        )
        self.assertEqual(response["faceCount"], 2)
        self.assertEqual(response["blurScore"], 155.2)


if __name__ == "__main__":
    unittest.main()
