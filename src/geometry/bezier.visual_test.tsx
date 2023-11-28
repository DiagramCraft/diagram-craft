import { BezierUtils } from './bezier.ts';

export const BezierVisualTest = () => {
  //const curve = [100, 100, 30, 50, 0, 0, 1, 162.55, 162.45];
  //const curve = [100, 100, 30, 50, -45, 0, 1, 215.1, 109.9];
  //const curve = [80, 80, 45, 45, 0, 0, 0, 125, 125];
  //const curve = [230, 80, 45, 45, 0, 1, 0, 275, 125];
  //const curve = [80, 230, 45, 45, 0, 0, 1, 125, 275];
  const curve = [230, 230, 45, 45, 0, 1, 1, 275, 275];
  const beziers = BezierUtils.fromArc(
    curve[0],
    curve[1],
    curve[2],
    curve[3],
    curve[4],
    curve[5] as 0 | 1,
    curve[6] as 0 | 1,
    curve[7],
    curve[8]
  );

  const curveAsString =
    'M ' +
    curve.slice(0, 2).join(' ') +
    ', A ' +
    curve.slice(2, 7).join(' ') +
    ', ' +
    curve.slice(7).join(' ');
  const bezierAsString =
    `M ${curve[0]} ${curve[1]}, ` + beziers.map(b => '' + b.join(' ')).join(',');

  return (
    <svg id="canvas" width="800" height="600" style={{ background: 'white' }}>
      <path d={curveAsString} stroke="black" fill="none" strokeWidth="2" fillOpacity="0.5" />

      <path d={bezierAsString} stroke="red" fill="none" strokeWidth="2" fillOpacity="0.5" />
    </svg>
  );
};
