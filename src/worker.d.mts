import { Config, WorkerMessage } from "@neume-network/schema";

export type ExtractionWorkerHandler =  (message: WorkerMessage) => Promise<WorkerMessage>;

export default function ExtractionWorker(config: Config): ExtractionWorkerHandler