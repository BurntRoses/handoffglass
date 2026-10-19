<div align="center">

<img src="assets/brandmark.svg" alt="HandoffGlass" width="76" height="76" />

# HandoffGlass

**次の一手を、見えるかたちに。**

AI エージェントのためのローカル対話レイヤー。操作する場所を示し、人の判断を受け取り、元のエージェントへ結果を戻します。

[English](README.md) · [简体中文](README.zh-CN.md) · [**日本語**](README.ja.md)

[はじめる](#はじめる) · [連携](#連携) · [ビジュアルシステム](#ビジュアルシステム) · [ドキュメント](#ドキュメント)

<img src="assets/hero.svg" alt="HandoffGlass のデスクトップ案内と人への引き継ぎを示すコンセプト図" width="100%" />

</div>

[インストールと連携](site/getting-started.html)

[初回起動とデスクトップ版](docs/ONBOARDING.md)

[ブランドとアプリアイコン](docs/BRAND.md) · [UI デザイン](docs/INTERFACE_SYSTEM.md)

## エージェントが進め、人が決める

サインイン、アクセス権の確認、アカウントの選択。人の判断が必要な場面で、HandoffGlass は画面上の対象を示し、操作結果をエージェントに返します。

<img src="assets/interaction-flow.svg" alt="HandoffGlass interaction flow" width="100%" />

| | |
|:--|:--|
| **画面で案内** | 矢印、リング、スポットライト、更新できるレイヤー。 |
| **人に引き継ぐ** | 完了・拒否・キャンセルを区別する専用パネル。 |
| **作業に戻る** | 状態を構造化して返し、実際の結果はエージェントが検証。 |
| **ローカル中心** | 共有ブローカー、許可制の UI 要素検索、端末内の表示設定。 |

### デスクトップ・コントロールセンター

トレイの **Control Center** から、ローカルサービスの状態、各エージェント用 MCP 設定、表示設定、読み取り専用 UI 検索の許可、簡潔な診断を確認できます。API の利用履歴は、特定のクライアントが接続済みであることを保証しません。[詳細](docs/CONTROL_CENTER.md)。


## はじめる

**Node.js 22+** · **macOS / Windows** · MCP に対応したローカルエージェント

```bash
git clone https://github.com/BurntRoses/handoffglass.git
cd handoffglass
npm ci
npm run verify
npm run configure
```

生成された設定を利用するか、stdio MCP サーバーを直接登録します。

```json
{
  "mcpServers": {
    "handoffglass": {
      "command": "node",
      "args": ["/absolute/path/to/handoffglass/src/mcp.mjs"]
    }
  }
}
```

実際の画面表示は `npm run desktop:demo`、シーンのプレビューは `npm run gallery` で確認できます。多言語の[製品プレビュー](site/index.html)は `npm run site:preview` で起動します。

## 連携

`Claude Code` · `Codex` · `Cursor` · `VS Code` · `Gemini CLI` · `TRAE` · `Cline` · `Windsurf` · `OpenCode` · `Zed`

[DeepSeek Harness 用 Cordis プラグイン](integrations/deepseek-harness/)と [WorkBuddy 用 MCP + Skill コネクター](integrations/workbuddy/)も用意しています。各ホスト上での受け入れ試験は今後実施します。[対応状況](docs/COMPATIBILITY.md)をご覧ください。

## ビジュアルシステム

6 種類のシーンテンプレート、7 種類の SVG プリミティブ。レイヤー更新、手描きの輪郭、柔らかなハイライト、段階的な案内を共通レンダラーで描画します。

```bash
npm run gallery
npm run preferences -- set visualStyle=handdrawn
```

ユーザーの表示設定を優先します。UI 要素の検索は許可制で、クリックや承認は代行しません。

## ドキュメント

[アーキテクチャ](docs/ARCHITECTURE.md) · [シーン仕様](docs/SCENE_PROTOCOL.md) · [ビジュアルガイド](docs/VISUAL_LANGUAGE.md) · [MCP Skill](skills/visual-handoff/SKILL.md) · [ネイティブ実行環境](docs/NATIVE_RUNTIME.md) · [セキュリティ](docs/SECURITY.md)

<sub>非公開の開発プレビュー。インストーラーは未署名です。CI はパッケージと MCP 起動を検証していますが、画面操作の実機試験は継続中です。ライセンス: UNLICENSED。</sub>
