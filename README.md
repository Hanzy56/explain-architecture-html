# explain-architecture-html

コードと要件から、業務フローとアーキテクチャをつなぐHTMLを作るCodexスキル。
「誰が何をするか」から、その処理を支える画面・API・モジュール・保存先をたどれます。

## 作成するもの

- **説明ページ**：業務フロー、全体構成、各段階の処理を図と文章で説明。
- **詳細構成図**：ノードを選んで、モジュールの役割・接続・根拠コードを探索。
- **編集用データ**：原稿と図の仕様を保存し、修正・再生成に利用。

Webアプリ、ライブラリ、CLIに対応。説明ページと詳細図を相互にリンクします。

## 必要な環境

- Codex（ローカルファイルとコマンドを扱える環境）
- Node.js 20以上、Git
- ChromeまたはChromium（詳細図の生成・表示検査に使用）
- GitHubへのネット接続（生成ツールの取得に使用）

## インストール

Codexに次のように依頼します。

```text
$skill-installer を使って、Hanzy56/explain-architecture-html の
skills/explain-architecture-html をインストールしてください。
```

プロジェクトで共有する場合は、`skills/explain-architecture-html` フォルダーを
プロジェクトの `.agents/skills/explain-architecture-html/` にコピーしてコミットします。

## 使い方

対象プロジェクトを開いて依頼します。

```text
$explain-architecture-html を使って、このプロジェクトの業務フローと
アーキテクチャを、新しく参加するメンバー向けのHTMLにしてください。
```

既存のHTMLへの指摘を渡して、説明や図を改善することもできます。
生成・検証の詳細は [rendering.md](skills/explain-architecture-html/references/rendering.md) を参照してください。

## 利用ツール

説明ページに [Answer me with HTML](https://github.com/QingYunA/answer-me-with-html)、
詳細構成図に [Archify](https://github.com/tt-a1i/archify) を使用します。
指定バージョンを作業用フォルダーへ取得するため、個別のスキル登録は不要です。

## ライセンス

[MIT](LICENSE)。第三者の出典とライセンスは [NOTICE](skills/explain-architecture-html/NOTICE.md) を参照してください。
