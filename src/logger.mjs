import debug from "debug";

const name = "music-os-extraction-worker";
const log = (subname) => debug(`${name}:${subname}`);
export default log;
