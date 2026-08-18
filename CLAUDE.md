# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# 小学校むけ さんすう教材

## プロジェクト概要
小学生（主に1〜3年生）向けの算数教材。ブラウザで動く単一HTMLファイル群。
先生や保護者が授業・家庭学習で使うことを想定。

## 開発コマンド
ビルド・テスト・lint は存在しない。動作確認はブラウザで直接開く。

```sh
open gaisuu.html     # macOS。編集したファイルをそのまま開く
```

JS の構文チェックだけしたいときは、インラインの `<script>` を抜き出して評価する：

```sh
node -e "const s=require('fs').readFileSync('gaisuu.html','utf8');[...s.matchAll(/<script>([\s\S]*?)<\/script>/g)].forEach(m=>new Function(m[1]));console.log('OK');"
```

## 技術方針
- ビルドツールなし、CDNなし、フレームワークなし
- 各教材は単一HTMLファイルで完結（HTML + CSS + JS をすべて1ファイルに）
  - 例外：allay / clock / division / kurainohyou / number_tiles は旧い共有 `style.css` / `script.js` も読む。新規教材では使わない
- タッチ操作（iPad等）を前提としたUI設計
- `pointer events`（pointerdown / pointermove / pointerup）を使用。mouseイベントは使わない
- `setPointerCapture` でドラッグ中のポインタロストを防ぐ
- 図は SVG が基本（要素ごとに部分更新できる）。canvas は number_line.html のみ

## UI・デザイン方針
- テキストはひらがな優先（小学生が読めること）。漢字にはルビ
- **直感的にわかることが最優先**。長い文字指示は置かず、点線のゴースト表示・色・形で誘導する
- ボタンはできるだけピクトグラム。言葉は `title` / `aria-label` に逃がす
- 派手すぎず、視認性を優先した配色
- アニメーションは控えめに。`prefers-reduced-motion` を尊重する
- ボタンや操作要素は大きめ（タップしやすい）
- コメントは最小限。自明なことは書かない

## 全教材で共通のパターン
- **ヘルプ**：各ファイル末尾に「そうさせつめい」ブロック（`.help-btn` / `#help-overlay` / `#help-modal` の CSS + JS）を丸ごとコピーし、`HELP` オブジェクトの `title` / `body` だけ差し替える。新規教材もこれを踏襲する
- **教材の登録**：`index.html` の `.cards` にカード（アイコン絵文字・タイトル・説明）を1枚追加する
- **描画の分割**：`state` に全状態を持ち、`renderAll()`（構造の作り直し）と部分描画関数（ドラッグ中はこちらだけ）に分ける

## 設計メモ
教材ごとの設計メモは `docs/design/<教材名>.md` に1本ずつ置く。**その教材を触るときだけ読む**。
CLAUDE.md には全教材に共通する話だけを書き、個別の設計はここに書かない（毎回読み込まれて膨らむため）。
教材を他所へ移すときは、HTMLと対応するメモをセットで持っていけばよい。

新規教材を作ったら、同じ名前でメモを1本追加する。

## ファイル一覧
| ファイル | 内容 | 設計メモ |
|---|---|---|
| index.html | トップページ（教材一覧） | |
| kurainohyou.html | くらいのひょう（たしざん・ひきざん） | ○ |
| clock.html | とけいのがくしゅう | ○ |
| ikutsu.html | いくつといくつ（さくらんぼ計算） | |
| allay.html | かけ算がくしゅう（アレイ図） | |
| kuku.html | 九九のがくしゅう | |
| division.html | わり算 | |
| angle.html | かくどのがくしゅう（分度器） | |
| number_line.html | 数直線ドロー（唯一の canvas 教材） | |
| number_tiles.html | かず タイル | |
| polygon.html | 正多角形ドロー | |
| gaisuu.html | がいすう（四捨五入を数直線で） | ○ |
| taikakusen.html | たいかくせん（対角線から図形をつくる） | ○ |
