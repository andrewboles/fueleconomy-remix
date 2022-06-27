
import { css } from "@emotion/react";
import GridLoader from "react-spinners/GridLoader";

const override = css`
display: block;
margin: 0 auto;
`;


export const Spinner = () => {

    return (
      <div className="load-set">
        <h2>loading..</h2>
        <GridLoader color={"#01b401"} css={override} size={50} />
      </div>
    )
  }