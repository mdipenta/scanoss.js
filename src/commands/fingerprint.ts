import { isFolder } from "./helpers";
import { ScannerEvents, WfpCalculator } from "..";
import { Tree } from "../lib/tree/Tree";
import { FilterList } from "../lib/filters/filtering";
import { FingerprintPacket } from "../lib/scanner/WfpProvider/FingerprintPacket";
import fs from 'fs';
import { defaultFilter } from "../lib/filters/defaultFilter";
import cliProgress from 'cli-progress';


export async function fingerprintHandler(rootPath: string, options: any): Promise<void> {

  rootPath = rootPath.replace(/\/$/, '');  // Remove trailing slash if exists
  rootPath = rootPath.replace(/^\./, process.env.PWD);  // Convert relative path to absolute path.
  const pathIsFolder = await isFolder(rootPath);
  const wfpCalculator = new WfpCalculator();

  const tree = new Tree(rootPath);
  const filter = new FilterList('');
  filter.load(defaultFilter as FilterList);

  tree.loadFilter(filter);
  tree.buildTree();

  const filesToFingerprint = tree.getFileList();

  const optBar1 = { format: 'Fingerprinting Progress: [{bar}] {percentage}% | Fingerprinted {value} files of {total}' };
  const bar1 = new cliProgress.SingleBar(optBar1, cliProgress.Presets.shades_classic);
  bar1.start(filesToFingerprint.length, 0);

  let fingerprints = '';
  wfpCalculator.on(ScannerEvents.WINNOWING_NEW_CONTENT, (fingerprintPacket: FingerprintPacket) => {
    bar1.increment(fingerprintPacket.getNumberFilesFingerprinted());
    fingerprints = fingerprints.concat( fingerprintPacket.getContent() );
  });

  if (options.verbose)
    wfpCalculator.on(ScannerEvents.WINNOWER_LOG, (log: string) => {
      console.error(log);
    });

  wfpCalculator.on(ScannerEvents.WINNOWING_FINISHED, () => {
    bar1.stop();
    if(options.output) {
      fs.writeFileSync(options.output, fingerprints);
    } else {
      console.log(fingerprints);
    }
  });


  wfpCalculator.start({fileList: filesToFingerprint, folderRoot: rootPath});


}