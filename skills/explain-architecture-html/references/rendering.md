# 生成・再生成・表示確認

## ツールの準備

Node.js 20以降とGitを使う。標準のArchify `finalize` はChromeまたはChromiumで表示を検査するため、その実行環境も確認する。通常の探索場所にない場合は、`ARCHIFY_CHROME` にブラウザーの実行ファイルの絶対パスだけを設定する。引数を含めず、設定したパスが実在することを確認する。既に使える実行環境を優先し、対象アプリのpackage.jsonへ依存を追加しない。パスは呼び出したプロジェクトとskillの場所から解決し、以下の大文字のプレースホルダーを実際の絶対パスに置き換える。

初回は新しい作業専用ディレクトリを使う。参照ツールのrevisionとCLIパスは `scripts/toolchain.json` に固定している。対応版の変更は、表示調整と検証をセットで更新する。

```text
node SKILL/scripts/prepare-tools.mjs TOOLS
```

成功時に返すCLIパスを使う。プロジェクト内にArchify等のskillがあることや、この作業を実施した端末のパスを前提にしない。取得した各ツールのSkillと関連するschemaを読む。ツールが利用できない場合は理由を報告し、ユーザーの許可範囲で利用可能なHTML生成方法を選ぶ。ツールの検証を実行していない代替出力は、そのツールで検証済みと表示しない。

## 生成

新規の出力フォルダに `explainer.md`、`candidate.json`、`module-guide.json`、`presentation.json` を作る。フォルダはユーザー指定を優先し、それ以外は対象プロジェクト内の説明用フォルダを使う。既存ページを直す場合は同じフォルダを再利用する。

1. 詳細図用rendererを**作業用checkout内だけ**調整する。共用のインストールには実行しない。

   ```text
   node SKILL/scripts/customize-viewer.mjs TOOLS/archify OUTPUT/candidate.json OUTPUT/module-guide.json OUTPUT/presentation.json
   ```

   スクリプトは対応revisionと必要なmarkerを検査する。UI構造が違う版に黙って一部だけ適用しない。役割、業務の対応、戻り導線、日本語フォント、接続の用語説明、末尾で展開するソース参照を生成前に組み込む。

2. 説明をCLIで生成する。`AM_HOME` は作業専用の設定ディレクトリへ、`AM_NO_UPDATE_CHECK` は `1` へ設定し、通常の個人設定への書き込みを避ける。

   ```text
   node AM_CLI render OUTPUT/explainer.md -o OUTPUT/index.html --no-open
   node SKILL/scripts/present-explainer.mjs OUTPUT/index.html OUTPUT/presentation.json
   ```

   Markdownに `presentation.json` の `diagramHref` と `linkTitle` に一致する詳細図リンクを含める。後処理はそのリンクを主要コンテンツの案内カードへ変え、冒頭の幅、外部リンクの新規タブ、不要な制作クレジットの表示を整える。内蔵の編集用Markdownは維持する。文言を変更した場合も設定と原稿を揃える。

3. 詳細図を検証付きで生成する。

   ```text
   node ARCHIFY_CLI finalize architecture OUTPUT/candidate.json OUTPUT/architecture.html --repo-root PROJECT --quality showcase --out-dir OUTPUT/review-N --json
   ```

   repository-backed候補には `--repo-root` を指定する。Git identityのない説明なら、その根拠の扱いに合わせてrepository fieldsとオプションを省く。candidateの `meta.output` は実際の出力に合わせる。HTMLを変更するたびに新しい `review-N` を使い、旧HTMLの証跡を新HTMLへ流用しない。失敗した段階と診断を読み、修正後に該当の検証を完了する。非ゼロ終了を成功にしない。

両HTMLの表示には外部CDNを使わない。再配布時は取得元のLICENSEを成果物とともに保持する。利用したツールの名前・revisionは検証記録に残してよいが、読者向けの本文へ制作情報として追加しない。

## 表示確認

標準の生成・厳密検査と、読者が見たときの品質を区別する。実際のHTMLをブラウザで開き、業務フローの分岐、図のラベル、矢印、役割の表示順、戻る位置を確認する。狭い画面で図自体を横にスクロールすることと、ページ全体がはみ出すことも区別する。

Playwrightを利用できる場合は同梱の補助スクリプトを使える。Codexのbundled runtimeは依存環境の取得ツールで探し、特定ユーザーの絶対パスを保存しない。Chromeを使う場合は末尾に `chrome` を指定する。別の利用可能なブラウザツールを使ってもよい。

```text
node SKILL/scripts/verify-pages.mjs OUTPUT PLAYWRIGHT_MODULE_DIRECTORY chrome
```

補助検査はHTMLのhash、内蔵原稿、複数の画面幅、ヘッダーの幅、案内カード、外部リンク、ページ間の往復、役割と根拠の表示順を確認し、`OUTPUT/browser-check/` に結果とcaptureを保存する。captureを実際に見てから、見た目も確認済みと伝える。日本語フォントが使われているかはChromiumの描画フォント情報も確認できる。

最終の検証記録には、HTML/specificationのhash、対象ソースのrevisionと変更状態、ツールのrevision、生成の結果、ブラウザ確認の結果・画面幅、未確認の範囲を含める。構成図の同じ交差が未解決なら、見た目の確認なしに配置を変え続けず、影響する経路を確認して読めるか判断する。

## 再配布

ZIPを作る場合は、編集した2つのHTML、原稿、仕様、表示設定、責務、検証記録、ライセンスの明示manifestで作る。リポジトリ全体やツールcheckoutを再帰的に梱包しない。ZIPの内容と読み出しの整合性、検証したHTMLと同じbytesであることを確認する。
