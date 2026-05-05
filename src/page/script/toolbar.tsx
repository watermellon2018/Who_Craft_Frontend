import React from 'react';
import { $createTextNode, $getRoot, LexicalEditor } from 'lexical';

type Props = {
    editor: LexicalEditor;
};

const ScenarioToolbar: React.FC<Props> = ({ editor }) => {
    const insertElement = (type: string, content: string) => {
        editor.update(() => {
            const root = $getRoot();
            root.append($createTextNode(`${type}: ${content}`));
        });
    };

    return (
        <div className="toolbar">
            <button onClick={() => insertElement('Персонаж', 'Иван')}>Персонаж</button>
            <button onClick={() => insertElement('Действие', 'Входит в комнату')}>Действие</button>
            <button onClick={() => insertElement('Диалог', 'Привет!')}>Диалог</button>
            <button onClick={() => insertElement('Сцена', 'Интерьер. Квартира - День')}>Сцена</button>
            <button onClick={() => insertElement('Камерное направление', 'Крупный план')}>Камерное направление</button>
            <button onClick={() => insertElement('Замечание', 'Слишком шумно')}>Замечание</button>
            <button onClick={() => insertElement('Переход', 'CUT TO:')}>Переход</button>
            <button onClick={() => insertElement('Звук', 'Звук шагов')}>Звук</button>
        </div>
    );
};

export default ScenarioToolbar;