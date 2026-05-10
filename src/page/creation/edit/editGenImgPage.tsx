import React, {useEffect, useState} from 'react';
import DashboardHeader from "../../../modules/profile/components/DashboardHeader";
import {Button, Empty, Layout, Spin} from "antd";
import ImageCanvas from "../hero/canvas";
import {Content} from "antd/es/layout/layout";
import {useLocation, useNavigate} from "react-router-dom";
import {
    editGenerateImage,
} from "../../../api/characters";
import PathConstants from "../../../routes/pathConstant";
import EditGenComponent from "../edit_generation";
import {openNotificationWithIcon} from "../../../utils/global/notification";


const EditGenImgPage = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [isGenerating, setIsGenerating] = useState<boolean>(false);
    const [imageGeneratedUrl, setImageGeneratedUrl] = useState<string>('');

    useEffect(() => {
        const url = location.state?.imageUrl || ''
        setImageGeneratedUrl(url);
    }, [])

    const catchError = () => {
        setIsGenerating(false);
        setImageGeneratedUrl('');
        openNotificationWithIcon('Упс!',
            'Ошибка при генерации изображения. Что-то пошло не так',
            'error');
    }

    const displayGenImage = (response: any) => {
        const byteArray = response.data;
        const imageUrl = `data:image/png;base64,${byteArray}`;
        setImageGeneratedUrl(imageUrl);
        setIsGenerating(false);
    }


    const editHandle = async (correctionText: string) => {
        try {
            setIsGenerating(true);
            const params = {
                'url': imageGeneratedUrl,
                'correction': correctionText,
            }

            const response = await editGenerateImage(params);
            displayGenImage(response);
        } catch (error) {
            catchError();
        }
    }

    const readyEditHandle = () => {
        navigate(PathConstants.GENERATING, {
            state: {
                imageUrl: imageGeneratedUrl,
                project_id: location.state?.project_id,
                regenerated: true,
            },
        });
    }

    return (
        <>

            <DashboardHeader title="" />

            <Layout className="p-4 min-h-screen">
                <div className="p-4">


                    <Content className="flex m-0 16px">
                        <div className="flex-grow p-5 grid gap-y-6">
                            <div className='flex justify-end'>
                                <div className='flex'>
                                    {imageGeneratedUrl!='' ?
                                        <div>
                                            <Button onClick={readyEditHandle} className='mr-5'>Готово</Button>
                                        </div> :
                                        <></>
                                    }
                                    <div>
                                        <Button onClick={() => navigate(-1)}>Назад</Button>
                                    </div>
                                </div>
                            </div>

                            <div className='flex' style={{minHeight: '400px'}}>
                                <div className="mr-5 border-[#fab005] border h-full w-full flex items-center justify-center">

                                    {isGenerating ? <Spin /> :
                                        <>
                                            { imageGeneratedUrl == ''
                                                ?
                                                <Empty description='Постер не сгенерирован'
                                                       className='text-yellow'
                                                       image={Empty.PRESENTED_IMAGE_DEFAULT} /> :
                                                <ImageCanvas imageUrl={imageGeneratedUrl} />
                                            }
                                        </>
                                    }

                                </div>

                                <div className="w-3/6 flex flex-col justify-between">

                                    <div>
                                        {imageGeneratedUrl != '' && !isGenerating ?
                                            <EditGenComponent editHandle={editHandle} /> : <></>
                                        }
                                    </div>
                                </div>


                            </div>
                        </div>

                    </Content>
                </div>
            </Layout>
        </>
    )
}

export default EditGenImgPage;