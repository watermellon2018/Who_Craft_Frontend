import axios from 'axios';

const backendUrl = process.env.REACT_APP_BACKEND_URL;


async function get_all_genres(): Promise<any> {
    try {
        return await axios.get(`${backendUrl}/api/projects/properties/genre/select/`, {
            params: {
            }
        });
    } catch (error) {
        console.error('Error generating image to image:', error);
    }

}

export { get_all_genres }