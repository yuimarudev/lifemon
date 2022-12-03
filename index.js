import BleUart from "@danielgjackson/ble-uart";
import { Client as RPCClient } from "@xhayper/discord-rpc";
import { Client as TwitterClient } from "twitter.js";
import { config } from "dotenv";
config();

const time = Date.now();

const rpcClient = new RPCClient({
  clientId: process.env.rpcId,
});

const twitterClient = new TwitterClient({ events: ["FILTERED_TWEET_CREATE"] });

const queries = [{}, {}, {}].map((_, i) => {
  return { type: i };
});

const format = (x) => JSON.stringify(x) + "\r\n";

let light = { type: 2, level: 0 };
let temp = { type: 0, temp: 0 };

async function main(address) {
  const bleUart = await BleUart.scanForBleUart(address);

  bleUart.addLineReader((line) => {
    const parsed = JSON.parse(line);

    switch (parsed.type) {
      case 0:
        temp = parsed;
        break;
      case 2:
        light = parsed;
        break;
    }
  });

  await bleUart.connect();

  setInterval(() => {
    for (let query of queries) {
      bleUart.write(format(query));
    }

    rpcClient.user?.setActivity({
      details: "周りの気温は" + temp.temp + "°C",
      state: "周りの明るさは" + light.level + "(0~255)",
      largeImageKey: "hotter",
      largeImageText: "Microbitで監視中",
      instance: false,
      startTimestamp: time,
      buttons: [
        {
          label: "Microbitのソースコード",
          url:
            "https://github.com/" + process.env.username + "/mircobit-school",
        },
        {
          label: "監視のソースコード",
          url: "https://github.com/" + process.env.username + "/lifemon",
        },
      ],
    });
  }, 5000);
}

twitterClient.on("filteredTweetCreate", async (s) => {
  if (!s.mentions.some((user) => user.username === "yuimarudev")) return;
  if (!s.text?.match("stat")) return;

  await s
    .reply({
      text: `周りの気温は${temp.temp}°C\n周りの明るさは${light.level} (0~255)`,
    })
    .catch(console.error);
});

await twitterClient.login(process.env);
await rpcClient.login();
await main("F3:D6:41:2E:95:19");
await Promise.all(
  (
    await twitterClient.filteredStreamRules.fetch([])
  ).map(async (x) => await twitterClient.filteredStreamRules.deleteById(x.id))
);
await twitterClient.filteredStreamRules.create({
  value: "@" + process.env.username,
});
