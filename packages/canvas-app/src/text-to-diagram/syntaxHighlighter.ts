export const applySyntaxHighlighting = (lines: string[], errors: Array<string | undefined>) => {
  const result: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const error = errors[i];

    let dest = line;
    dest = dest.replaceAll(/("[^"]+")/g, '<span class="syntax-string">$1</span>');
    dest = dest.replaceAll(/^(\s*props):/g, '<span class="syntax-props">$1</span>:');
    dest = dest.replaceAll(/^(\s*[^:]+):/g, '<span class="syntax-label">$1</span>:');
    dest = dest.replaceAll(/({|})/g, '<span class="syntax-bracket">$1</span>');

    if (error) {
      dest = `<span class="syntax-error">${dest}</span>`;
    }

    result.push(dest);
  }

  return result;
};
