const transpose = (matrix: string[][]) =>
  Object.keys(matrix[0]).map(colNumber =>
    matrix.map(rowNumber => rowNumber[colNumber as unknown as number])
  );

export const ColorGrid = (props: Props) => {
  return (
    <div className={'color-grid'}>
      <div className={'color-grid__primary'}>
        {props.primaryColors.map(c => (
          <button
            key={c}
            style={{ backgroundColor: c }}
            onClick={() => props.onClick?.(c)}
          ></button>
        ))}
      </div>

      {props.additionalHues && (
        <div className={'color-grid__additional'}>
          {transpose(props.additionalHues).map(arr => {
            return arr.map((c, idx) => (
              <button
                key={idx}
                style={{ backgroundColor: c }}
                onClick={() => props.onClick?.(c)}
              ></button>
            ));
          })}
        </div>
      )}
    </div>
  );
};

type Props = {
  primaryColors: string[];
  additionalHues?: string[][];
  onClick: (s: string) => void;
};
