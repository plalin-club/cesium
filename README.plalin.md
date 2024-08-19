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

原因は Cloudflare Pages の独自仕様である ”リクエストの URL から .html を自動的にトリミングする” に起因するものと考えられる。

参考: https://community.cloudflare.com/t/cloudflare-pages-truncates-urls-by-removing-the-html-extension/609238

暫定対応として

```html
<iframe src="template/bucket.html"></iframe>
```

を

```html
<iframe src="template/bucket"></iframe>
```

に置換するスクリプトを gulpfile.js に追加した。

## 404 対応

Cloudflare Pages は 404.html がない場合は index.html などを自動的に表示する。

それだとミスに気づきにくいケースがあるため シンプルな 404.html 生成を package.json の script cf-pages に追加した。
