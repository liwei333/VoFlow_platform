export default function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="flex items-center justify-center h-96">
      <div className="text-center">
        <div className="text-4xl mb-4">🚧</div>
        <h2 className="text-xl font-medium text-gray-900 mb-2">{title}</h2>
        <p className="text-gray-500">该功能正在开发中，敬请期待...</p>
      </div>
    </div>
  );
}
