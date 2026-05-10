import React, { useState, useEffect } from 'react';
import {Link, useLocation, useNavigate} from 'react-router-dom';

import {Input, Button} from 'antd';


interface EditGenComponentI {
    editHandle: (t: string) => void;
}

/**
 * Компонент для редактирования сгенерированного изображения.
 * Просит внести правки в сгенерированное изображение
 **/
export const EditGenComponent: React.FC<EditGenComponentI> = ({editHandle}) => {
    const [correction, setCorrection] = useState<string>('');
    const handleArea = (newVal: any) => {
        setCorrection(newVal.target.value);
    }



    return (
        <>
            <Input.TextArea
                rows={5}
                value={correction}
                onChange={handleArea}
                placeholder='Что хотите исправить в сгенерированном изображении?' />
            <div className="mt-2 flex justify-end">
            <Button
                onClick={() => editHandle(correction)}
                style={{ minWidth: '120px' }}
                className="border border-black"
                type="primary"
                htmlType="submit">
                Править
            </Button>
        </div>
        </>
    );
}

export default EditGenComponent;

