export const Icon = ({ name, size = 20, color, className = '', style = {}, ...rest }) => (
  <span
    className={`material-symbols-outlined ${className}`}
    style={{
      fontSize: size,
      color: color,
      lineHeight: 1,
      fontVariationSettings: "'FILL' 0, 'wght' 400",
      ...style,
    }}
    {...rest}
  >
    {name}
  </span>
);
