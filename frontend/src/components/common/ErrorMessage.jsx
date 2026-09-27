export default function ErrorMessage({
  title = 'Something went wrong',
  message = 'Please try again later',
  onRetry,
  className = '',
}) {
  return (
    <div className={`bg-red-50 border border-red-200 rounded-lg p-6 text-center ${className}`}>
      <span className="material-symbols-outlined text-4xl text-red-500 block mb-3">
        error_outline
      </span>
      <h4 className="text-lg font-semibold text-red-700">{title}</h4>
      <p className="text-sm text-red-600 mt-1">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 px-6 py-2 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 transition-colors active:scale-95"
        >
          Try Again
        </button>
      )}
    </div>
  );
}
