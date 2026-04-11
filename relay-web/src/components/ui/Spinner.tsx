export function Spinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const cls = {
    sm: 'w-4 h-4 border-2',
    md: 'w-8 h-8 border-2',
    lg: 'w-12 h-12 border-[3px]',
  }[size];
  return (
    <div
      className={`${cls} border-indigo-500 border-t-transparent rounded-full animate-spin`}
    />
  );
}
