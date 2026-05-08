import React from 'react';
import HeaderComponent from "./header";
import withAuth from "../../utils/auth/check_auth";
import {useNavigate} from "react-router-dom";
import PathConstants from "../../routes/pathConstant";
import '../global.css';
export const MainPage = () => {
    const navigate = useNavigate();

    const createProjectHandle = () => {
        navigate(PathConstants.CREATE_PROJECT, {state: {is_edit: false}});
    }

    const myLibraryHandle = () => {
        navigate(PathConstants.PROJECTS)
    }

    const myCabinetHandle = () => {
        navigate(PathConstants.PROFILE)
    }

    return (

        <div className="bg-[#1B1D22] text-white flex flex-col justify-between h-screen">
        <div className="flex flex-col h-full justify-between">
            <HeaderComponent />
            <div className="flex flex-col items-center">
            <main className="grid grid-cols-3 gap-5 p-6 w-2/3 max-w-2xl flex justify-center items-center"
                  style={{minHeight: "300px"}}
            >
                <div onClick={createProjectHandle}
                     className="effect-button-div bg-[#FAB005] rounded-lg h-2/4 min-h-160 flex items-center justify-center text-[#1B1D22] font-bold text-2xl"
                     style={{height: "-webkit-fill-available"}}>СОЗДАТЬ</div>
                <div onClick={myLibraryHandle}
                     className="effect-button-div bg-[#FAB005] rounded-lg h-2/4 min-h-160 flex items-center justify-center text-[#1B1D22] font-bold text-2xl"
                     style={{height: "-webkit-fill-available"}}>
                    МОИ ПРОЕКТЫ
                </div>
                <div className="effect-button-div bg-[#FAB005] rounded-lg h-2/4 min-h-160 button-size" style={{height: "-webkit-fill-available"}}></div>
                <div className="effect-button-div bg-[#FAB005] rounded-lg h-2/4 min-h-160 button-size" style={{height: "-webkit-fill-available"}}></div>
                <div className="effect-button-div bg-[#FAB005] rounded-lg h-2/4 min-h-160 button-size" style={{height: "-webkit-fill-available"}}></div>
                <div 
                    onClick={myCabinetHandle}
                    className="effect-button-div bg-[#FAB005] rounded-lg h-2/4 min-h-160 button-size flex items-center justify-center text-[#1B1D22] font-bold text-2xl" 
                    style={{height: "-webkit-fill-available"}}>
                    МОЙ КАНАЛ
                </div>
            </main>
            </div>
            <footer className="flex justify-between p-6 text-xs">
                <div>Framer 2023</div>
                <div>Amsterdam</div>
            </footer>
        </div>
        </div>
        );


}
export default withAuth(MainPage);