/** ゲストモードのダミー投稿・ダミーEntryの文言（日本語）。 */
export const guest = {
    "guest.userName": "ゲストユーザー",
    "guest.imageLabel": "画像",
    "guest.sampleImageAlt": "サンプル画像",
    "guest.sampleImage2Alt": "サンプル画像2",
    "guest.sampleImageN": "サンプル画像{index}",
    "guest.post1.text": "これはゲスト用デモ表示のサンプル投稿です。",
    "guest.post2.text":
        "画像投稿で、URL発行を行った際の表示です。（共有ボタンやポップアップボタンで再度他SNSへ投稿可能）",
    "guest.entry1.heading": "サンプルEntry",
    "guest.entry1.postCaption": "ゲスト表示用のダミーEntryです。",
    "guest.post3.text":
        "画像投稿で、URL発行をしなかった場合の表示です。（あとからSkyshare Entry作成可能）",
    "guest.video.text":
        "動画を添付した投稿の表示です。（サムネイルに再生ボタンが重なり、Timelineでは再生されない）",
    "guest.video.alt": "サンプル動画",
    "guest.videoUnsupported.text":
        "引用投稿に動画が添付された投稿の表示です。（Skyshareでは再生できない旨が表示される）",
    "guest.multi.text":
        "画像を6枚添付した投稿の表示です。（全画像が横スクロールのサムネイルで並ぶ）",
    "guest.threadA.tailText": "スレッドA・3件目です。",
    "guest.threadA.midText":
        "スレッドA・2件目です。画像付きでentry未作成です。",
    "guest.threadA.rootText": "スレッドA・1件目（ルート、画像なし）です。",
    "guest.threadA.imageAlt": "スレッドAサンプル画像",
    "guest.threadB.tailText": "スレッドB・2件目です。",
    "guest.threadB.rootText": "スレッドB・1件目（ルート、entry作成済み）です。",
    "guest.threadB.imageAlt": "スレッドBサンプル画像",
    "guest.threadB.entryHeading": "スレッドBサンプルEntry",
    "guest.threadB.entryCaption": "ゲスト表示用のスレッド由来ダミーEntryです。",
    "guest.threadC.tailText": "スレッドC・3件目です。",
    "guest.threadC.midText": "スレッドC・2件目です。",
    "guest.threadC.rootText": "スレッドC・1件目（ルート、画像あり）です。",
    "guest.threadC.imageAlt": "スレッドCサンプル画像",
    "guest.threadD.midText":
        "スレッドD・2件目です。旧仕様でこの投稿にentryが作成されています。",
    "guest.threadD.entryHeading": "スレッドDサンプルEntry",
    "guest.threadD.entryCaption": "ゲスト表示用の旧仕様ダミーEntryです。",
    "guest.threadD.rootText": "スレッドD・1件目（ルート、画像なし）です。",
    "guest.unknown.text":
        "Bluesky投稿の状態を確認できない場合の表示確認用の投稿です。",
    "guest.unknown.entryHeading": "判定不能サンプルEntry",
    "guest.unknown.entryCaption": "ゲスト表示用の判定不能ダミーEntryです。",
    "guest.entry2.heading": "元投稿削除済みのサンプル",
    "guest.entry2.caption":
        "紐づくBluesky投稿が削除された状態のサンプルです。Skyshare Entryが削除されない限りはURL参照可能です。",
} as const
