import React, { useState } from 'react';
import {useTranslation} from 'react-i18next';

import {Input, Button} from 'antd';


interface EditGenComponentI {
    editHandle: (t: string) => void;
}

/**
 * Collects the user's requested corrections for a generated image.
 **/
export const EditGenComponent: React.FC<EditGenComponentI> = ({editHandle}) => {
    const {t} = useTranslation();
    const [correction, setCorrection] = useState<string>('');
    const handleArea = (newVal: React.ChangeEvent<HTMLTextAreaElement>) => {
        setCorrection(newVal.target.value);
    }



    return (
        <>
            <Input.TextArea
                rows={5}
                value={correction}
                onChange={handleArea}
                placeholder={t('generationEdit.placeholder')} />
            <div className="mt-2 flex justify-end">
            <Button
                onClick={() => editHandle(correction)}
                style={{ minWidth: '120px' }}
                className="border border-black"
                type="primary"
                htmlType="submit">
                {t('generationEdit.action')}
            </Button>
        </div>
        </>
    );
}

export default EditGenComponent;

