async function translateGoogleFree(text) {
  const res = await fetch(
    `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=bn&dt=t&q=${encodeURIComponent(text)}`
  );
  const data = await res.json();
  return data[0][0][0];
}

export { translateGoogleFree };