interface AvatarProps {
  username: string;
  color: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizeMap = {
  sm: 'w-8 h-8 text-sm',
  md: 'w-12 h-12 text-lg',
  lg: 'w-16 h-16 text-2xl',
  xl: 'w-24 h-24 text-4xl',
};

export function Avatar({ username, color, size = 'md', className = '' }: AvatarProps) {
  return (
    <div
      className={`${sizeMap[size]} ${className} rounded-full flex items-center justify-center font-semibold text-white select-none`}
      style={{ backgroundColor: color }}
    >
      {username.charAt(0).toUpperCase()}
    </div>
  );
}
