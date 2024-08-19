# Sandcastle.plalin を Cloudflare Pages に Deploy

## Cloudflare Pages 設定内容

- github の branch を指定する
- 環境変数に PROD=1 をプロダクションもプレビューも両方に設定
- ビルド＆デプロイ
  - ビルドの構成
    - ビルドコマンド: npm run cf-pages
    - ビルド出力ディレクトリ: /Build/Sandcastle
    - ルート ディレクトリ: /
    - プル リクエストのビルド コメント: 有効-
- 2024.8 現在 Cesium の Build には nodejs v20 系を推奨だが、Cloudflare Pages の最新は v18 系であることに留意

## package.json

- .github/workflows/deploy.yml を参考に npm run cf-pages を準備した

## iframe (右側の Preview) が動かない

standalone.html は正常動作したが iframe src="template/bucket.html" がなにも表示されない現象が発生。

~~原因は Cloudflare Pages の独自仕様である ”リクエストの URL から .html を自動的にトリミングする” に起因するものと考えられる。~~

~~参考: https://community.cloudflare.com/t/cloudflare-pages-truncates-urls-by-removing-the-html-extension/609238~~

違うようだった。

_header による対応をしてみたがなかなかテストがうまくいかない

次のコマンドでローカルでも同様の現象が起きることを確認した。テストスピードアップ。

```shell
npx wrangler pages dev Build/Sandcastle
```

色々試す中、読み込み後 console から

```javascript
document.getElementById("bucketFrame").setAttribute("src", "templates/bucket.html")
// もしくは
document.getElementById("bucketFrame").contentWindow.location.reload();
```

を実行することで対応可能。

いろいろためすうちに、CesiumSandcastle.js のなかで、

```javascript
    if (bucketFrame.contentWindow.location.href.indexOf("bucket.html") > 0) {
```

という箇所があるが、ここが Cloudflare Pages だと .html をカットしてしまうため、おかしい動きになったものと思われる。
これを "bucket" にすることで回避した。

## 404 対応

Cloudflare Pages は 404.html がない場合は index.html などを自動的に表示する。

それだとミスに気づきにくいケースがあるため シンプルな 404.html 生成を package.json の script cf-pages に追加した。
