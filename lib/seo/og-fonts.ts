/** Load Inter from Google Fonts for Satori / ImageResponse (supports Cyrillic). */
export async function loadInterFont(
  weight: 600 | 700 | 800,
): Promise<ArrayBuffer> {
  const css = await fetch(
    `https://fonts.googleapis.com/css2?family=Inter:wght@${weight}&display=swap`,
    { cache: "force-cache" },
  ).then((res) => res.text());

  const match = css.match(
    /src: url\((.+)\) format\('(?:opentype|truetype)'\)/,
  );
  if (!match?.[1]) {
    throw new Error(`Failed to load Inter weight ${weight}`);
  }

  return fetch(match[1]).then((res) => res.arrayBuffer());
}

export async function loadOgFonts() {
  const [regular, semibold, bold] = await Promise.all([
    loadInterFont(600),
    loadInterFont(700),
    loadInterFont(800),
  ]);
  return [
    { name: "Inter", data: regular, weight: 600 as const, style: "normal" as const },
    { name: "Inter", data: semibold, weight: 700 as const, style: "normal" as const },
    { name: "Inter", data: bold, weight: 800 as const, style: "normal" as const },
  ];
}
