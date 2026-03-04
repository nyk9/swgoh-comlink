// fetchPlayer.ts
import { writeFile } from "node:fs/promises";

type PlayerRequestBody = {
  payload: {
    allyCode: string;
  };
  enums: boolean;
};

async function main() {
  // ここを自分の allyCode に変える
  const allyCode = "445833733";

  const body: PlayerRequestBody = {
    payload: {
      allyCode,
    },
    enums: false,
  };

  const url = "http://localhost:5001/player";

  // Node 18 以上なら標準 fetch が使える
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("Request failed:", res.status, res.statusText);
    console.error("Body:", text);
    process.exit(1);
  }

  const json = await res.json();

  // 出力ファイル名（適当に変えてOK）
  const outputPath = `player-${allyCode}.json`;

  await writeFile(outputPath, JSON.stringify(json, null, 2), "utf8");

  console.log(`Saved player data to ${outputPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
