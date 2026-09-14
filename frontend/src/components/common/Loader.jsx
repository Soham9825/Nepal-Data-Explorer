
export default function Loader({ size = 'md', fullScreen = false }) {
  const sizeClasses = {
    sm: 'w-4 h-4 border-2',
    md: 'w-8 h-8 border-3',
    lg: 'w-12 h-12 border-4',
  };

  const loader = (
    <div className={`${sizeClasses[size]} rounded-full border-primary border-t-transparent animate-spin`} />
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-white z-50">
        {loader}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center p-8">
      {loader}
    </div>
  );
}