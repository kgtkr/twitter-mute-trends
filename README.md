# Twitterトレンドミュート
トレンドに入っているキーワードのうち、yahooリアルタイム検索の「感情の割合」のネガティブな割合が一定以上のキーワードを自動で30日間ミュートするツール。

## 使い方
```
$ npm i
$ npm run build
$ cp .env.sample .env
# edit .env
$ npm start
```

## 環境変数
* `CONSUMER_KEY` / `CONSUMER_SECRET` / `ACCESS_TOKEN` / `ACCESS_TOKEN_SECRET`:  認証情報
* `WOEID`: トレンドの地域ID(日本は `23424856`)
* `NEGATIVE_THRESHOLD`: ネガティブツイート割合の閾値。デフォルト80
* `MUTE_DURATION_DAY`: ミュート期間(日)。デフォルト30
* `MAX_RETAIN`: 最大ミュート保持件数。これを超えると古いものから削除される。デフォルト200(Twitterの仕様で200件以上ミュートできないので実質制限なし)
