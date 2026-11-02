/* 기존 오리지널: 이미지 출연진과 첫 등장 프로필 이미지 */
for (const c of ORIGINALS) {
  if (c.cast) continue;
  const look = (c.persona.match(/외모:\s*([^\n]+)/) || [])[1] || "";
  c.cast = [{ code: "c", name: c.name, look }];
  c.openings.forEach((o) => { o.text = o.text.replace(/\n\n/, "\n\n[[img:c:0]]\n\n"); });
}
