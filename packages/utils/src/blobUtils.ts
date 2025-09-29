export const blobToDataURL = (blob: Blob): Promise<string> =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = _e => resolve(reader.result as string);
    reader.onerror = _e => reject(reader.error === null ? new Error('Read error') : reader.error);
    reader.onabort = _e => reject(new Error('Read aborted'));
    reader.readAsDataURL(blob);
  });
