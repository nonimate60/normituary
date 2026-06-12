export default function Logo({ className, style }) {
  return (
    <svg
      className={className}
      style={style}
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      shape-rendering="crispEdges"
      aria-hidden="true"
    >
      <g fill="currentColor">
        <rect x="19" y="8" width="73" height="14"/>
        <rect x="8" y="16" width="11" height="84"/>
        <rect x="81" y="22" width="11" height="78"/>
        <rect x="44" y="33" width="12" height="45"/>
        <rect x="31" y="44" width="38" height="12"/>
      </g>
    </svg>
  );
}
