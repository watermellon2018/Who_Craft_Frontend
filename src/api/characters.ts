import axios from 'axios';

const backendUrl = process.env.REACT_APP_BACKEND_URL;

interface FormData {
    gender: string;
    min?: number | undefined;
    max?: number | undefined;
    eyes?: string | undefined;
    hair?: string | undefined;
    body?: string | undefined;
    appearance?: string | undefined;
    character?: string | undefined;
    styleGen: 'anime' | 'real' | 'cartoon';
}
async function generateImageAPI(formData: FormData): Promise<any> {
    try {
        return await axios.get(`${backendUrl}api/generate/generate_image/`, {
            params: {
                gender: formData.gender,
                minAge: formData.min,
                maxAge: formData.max,
                eyes: formData.eyes,
                hair: formData.hair,
                body: formData.body,
                appearance: formData.appearance,
                character: formData.character,
                styleGen: formData.styleGen,
            }
        });
    } catch (error) {
        console.error('Error generating image:', error);
    }

}

interface FormDataUndefined {
    description: string | null;
    character: string | null;
    styleGen: 'anime' | 'real' | 'cartoon';
}

async function generateImageUndefinedAPI(formData: FormDataUndefined): Promise<any> {
    try {
        return await axios.get(`${backendUrl}api/generate/generate_image_undefined/`, {
            params: {
                description: formData.description,
                character: formData.character,
                styleGen: formData.styleGen,
            }
        });
    } catch (error) {
        console.error('Error generating image:', error);
    }

}

// img to img
interface FormImg2Img {
    url: string;
    prompt: string;
    character: string | null;
    styleGen: 'anime' | 'real' | 'cartoon';
}
async function generateImage2ImgAPI(formData: FormImg2Img): Promise<any> {
    try {
        return await axios.get(`${backendUrl}/api/generate/generate_image_to_image/`, {
            params: {
                url: formData.url,
                prompt: formData.prompt,
                character: formData.character,
                styleGen: formData.styleGen
            }
        });
    } catch (error) {
        console.error('Error generating image to image:', error);
    }

}


async function generatePosterApi(description: string): Promise<any> {
    try {
        return await axios.get(`${backendUrl}/api/generate/poster/`, {
            params: {
                description: description,
            }
        });
    } catch (error) {
        console.error('Error generating image to image:', error);
    }

}

interface EditGenerateI {
    url: string;
    correction: string;
}
async function editGenerateImage(data: EditGenerateI): Promise<any> {
    try {
        return await axios.post(`${backendUrl}/api/generate/edit/`, {
            data: {
                image: data.url,
                correction: data.correction,
            }
        });
    } catch (error) {
        console.error('Error edit image by promt:', error);
    }

}

export {generateImageAPI,
    generateImageUndefinedAPI,
    generateImage2ImgAPI,
    generatePosterApi,
    editGenerateImage,
};
