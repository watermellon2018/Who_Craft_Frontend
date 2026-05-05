import React, {FC, useEffect, useMemo, useRef, useState} from 'react';
import {useLocation, useNavigate} from "react-router-dom";
import {Button, Col, Row, Tooltip} from "antd";
import HeaderComponent from "../main/header";
import withAuth from "../../utils/auth/check_auth";
import 'ckeditor5/ckeditor5.css';
import { CKEditor, CKEditorContext } from '@ckeditor/ckeditor5-react';
import { BalloonEditor, DecoupledEditor, ClassicEditor, Bold, Essentials, Italic, Mention, Paragraph, Undo } from 'ckeditor5';
// import DocumentEditor from '@ckeditor/ckeditor5-build-document';
import {$getRoot, $createTextNode, LexicalEditor, $getSelection, EditorState} from 'lexical';

import {LexicalComposer} from '@lexical/react/LexicalComposer';
import {PlainTextPlugin} from '@lexical/react/LexicalPlainTextPlugin';
import {ContentEditable} from '@lexical/react/LexicalContentEditable';
import {OnChangePlugin} from '@lexical/react/LexicalOnChangePlugin';
import {useLexicalComposerContext} from '@lexical/react/LexicalComposerContext';
import {LexicalErrorBoundary} from '@lexical/react/LexicalErrorBoundary';
import './style.css'
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import {HistoryPlugin} from '@lexical/react/LexicalHistoryPlugin';
import { CodeHighlightNode, CodeNode } from "@lexical/code";
import { AutoLinkNode, LinkNode } from "@lexical/link";
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import {
    CODE,
    INLINE_CODE,
    LINK,
    BOLD_STAR,
    BOLD_ITALIC_UNDERSCORE,
    ITALIC_UNDERSCORE,
} from "@lexical/markdown";
import { MarkdownShortcutPlugin } from "@lexical/react/LexicalMarkdownShortcutPlugin";
import ScenarioToolbar from "./toolbar";


const TRANSFORMERS = [
    BOLD_STAR,
    ITALIC_UNDERSCORE,
    BOLD_ITALIC_UNDERSCORE,
    CODE,
    INLINE_CODE,
    LINK,
];


const theme = {
    paragraph: "paragraph",
    text: {
        bold: "textBold",
        italic: "textItalic",
        underline: "textUnderline",
    },
};



const MyOnChangePlugin: FC = () => {
    function onChange(editorState: EditorState) {
        editorState.read(() => {
            const root = $getRoot();
            const selection = $getSelection();

            console.log(root, selection);
        });
    }

    return <OnChangePlugin onChange={onChange} />;
};


// Lexical React plugins are React components, which makes them
// highly composable. Furthermore, you can lazy load plugins if
// desired, so you don't pay the cost for plugins until you
// actually use them.
function MyAutoFocusPlugin() {
    const [editor] = useLexicalComposerContext();

    useEffect(() => {
        editor.focus();
    }, [editor]);

    return null;
}

// Catch any errors that occur during Lexical updates and log them
// or throw them as needed. If you don't throw them, Lexical will
// try to recover gracefully without losing user data.
function onError(error: any) {
    console.error(error);
}

/**
 * https://ckeditor.com/docs/ckeditor5/latest/getting-started/installation/react/react.html
 **/
const ScriptPage = () => {

    const initialConfig = {
        namespace: "MyEditor",
        theme,
        onError(error: Error) {
            console.error(error);
        },
        nodes: [CodeNode, CodeHighlightNode, AutoLinkNode, LinkNode],
    };

    const [editorData, setEditorData] = useState('Hello from CKEditor 5 in React!');
    const editorRef = useRef(null);


    const handleSave = (event: any, editor:any) => {
        const data = editor.getData();
        setEditorData(data);
    };

    return (

        <>
            <HeaderComponent />
            <div className="project-page p-4 bg-gray-800 min-h-screen text-white">
                <div className='flex justify-between'>
                    <div className="mb-4 ml-5">
                        <h1 className="text-3xl font-bold mb-4">Сценарий</h1>
                    </div>
                    <div>
                        <Button type='primary' className='mr-5' >Сохранить</Button>
                        <Button>Готово</Button>
                    </div>
                </div>


                <Row className='container'>
                    <Col span={20} className='component'>

                        <div className="editorWrapper">
                            <LexicalComposer initialConfig={initialConfig}>
                                <RichTextPlugin
                                    contentEditable={<ContentEditable className={"editor"} />}
                                    placeholder={<div className={"placeholder"}>Введите текст</div>}
                                    ErrorBoundary={LexicalErrorBoundary}
                                />
                                <MyOnChangePlugin />
                                <MyAutoFocusPlugin />
                                <HistoryPlugin />
                                <MarkdownShortcutPlugin transformers={TRANSFORMERS} />
                                <LinkPlugin />
                            </LexicalComposer>
                        </div>
                    </Col>
                    <Col style={{display: 'flex', flexDirection: 'column', gap: '10px', }}>

                            <Tooltip color='#fab005' title='Описание действий, происходящих на сцене.'>
                                <Button>Действие</Button>
                            </Tooltip>
                            <Tooltip color='#fab005' title='Текст, произносимый персонажем.'>
                                <Button>Диалог</Button>
                            </Tooltip>
                            <Tooltip color='#fab005' title='Заголовок сцены, место и время действия.'>
                                <Button>Сцена</Button>
                            </Tooltip>
                            <Tooltip color='#fab005' title='Инструкции для оператора по съёмке.'>
                                <Button>Камера</Button>
                            </Tooltip>
                            <Tooltip color='#fab005' title='Переходы между сценами (например, "CUT TO:").'>
                                <Button>Переход</Button>
                            </Tooltip>
                            <Tooltip color='#fab005' title='Описание звуковых эффектов.'>
                                <Button>Звук</Button>
                            </Tooltip>
                            <Tooltip color='#fab005' title='Дополнительные примечания или комментарии.'>
                                <Button>Замечание</Button>
                            </Tooltip>

                    </Col>
                    <Col style={{display: 'flex', flexDirection: 'column', gap: '10px', }}>
                        Персонаж
                    </Col>


                </Row>
            </div>
        </>
    );
}

export default withAuth(ScriptPage);
