import React from 'react';

export default function CharacterEditorLayout({topBar, sidebar, center, right}: {topBar: React.ReactNode; sidebar: React.ReactNode; center: React.ReactNode; right: React.ReactNode}) {
  return (
    <div className="character-editor custom-scrollbar">
      <div className="character-editor__topbar">{topBar}</div>
      <div className="character-editor__workspace">
        <aside className="character-editor__categories custom-scrollbar">{sidebar}</aside>
        <main className="character-editor__canvas custom-scrollbar">{center}</main>
        <section className="character-editor__settings custom-scrollbar">{right}</section>
      </div>
    </div>
  );
}
