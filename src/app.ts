import Twit from "twit";
import { z } from "zod";
import axios from "axios";

const Env = z.object({
  CONSUMER_KEY: z.string(),
  CONSUMER_SECRET: z.string(),
  ACCESS_TOKEN: z.string(),
  ACCESS_TOKEN_SECRET: z.string(),
  NEGATIVE_THRESHOLD: z.preprocess(Number, z.number().int()).default(80),
  WOEID: z.string(),
  MUTE_DURATION_DAY: z.preprocess(Number, z.number().int()).default(30),
  MAX_RETAIN: z.preprocess(Number, z.number().int()).default(200),
});

const env = Env.parse(process.env);

const T = new Twit({
  consumer_key: env.CONSUMER_KEY,
  consumer_secret: env.CONSUMER_SECRET,
  access_token: env.ACCESS_TOKEN,
  access_token_secret: env.ACCESS_TOKEN_SECRET,
  timeout_ms: 60 * 1000,
  strictSSL: true,
});

const TrendsResult = z.tuple([
  z.object({
    trends: z.array(
      z.object({
        name: z.string(),
      })
    ),
  }),
]);

const TransitionResult = z.object({
  sentimentPieChart: z.object({
    negative: z.number(),
  }),
});

const MutesResult = z.object({
  muted_keywords: z.array(
    z.object({
      id: z.string(),
      keyword: z.string(),
      valid_from: z.string().nullable(),
      valid_until: z.string().nullable(),
    })
  ),
});

(async () => {
  const trendsResult = await T.get("trends/place", {
    id: env.WOEID,
  }).then(({ data }) => TrendsResult.parse(data));

  const mutesResult = await T.get("mutes/keywords/list").then(({ data }) =>
    MutesResult.parse(data)
  );

  const deleteMutes = mutesResult.muted_keywords
    .filter((mute) => mute.valid_until !== null)
    .sort((a, b) => Number(a.valid_until) - Number(b.valid_until))
    .slice(0, -env.MAX_RETAIN);

  if (deleteMutes.length > 0) {
    await T.post("mutes/keywords/destroy", {
      ids: deleteMutes.map((mute) => mute.id).join(","),
    } as any);

    console.log(
      `Deleted: ${deleteMutes.map((mute) => mute.keyword).join(", ")}`
    );
  }

  const now = Date.now();
  const mutes = new Set(
    mutesResult.muted_keywords
      .filter(
        (mute) =>
          (mute.valid_from === null || Number(mute.valid_from) <= now) &&
          (mute.valid_until === null || Number(mute.valid_until) > now)
      )
      .map((mute) => mute.keyword)
  );
  for (const { name: trend } of trendsResult[0].trends) {
    if (mutes.has(trend)) {
      continue;
    }
    try {
      const {
        sentimentPieChart: { negative },
      } = await axios
        .get(`https://search.yahoo.co.jp/realtime/api/v1/transition`, {
          params: {
            interval: "900",
            span: "86400",
            p: trend,
          },
        })
        .then(({ data }) => TransitionResult.parse(data));
      if (negative >= env.NEGATIVE_THRESHOLD) {
        await T.post("mutes/keywords/create", {
          keyword: trend,
          mute_surfaces: "notifications,home_timeline,tweet_replies",
          mute_options: "",
          duration: String(env.MUTE_DURATION_DAY * 24 * 60 * 60 * 1000),
        } as any);
        console.log(`muted ${trend}`);
      }
    } catch (e) {
      console.error(e);
    }
  }
})();
