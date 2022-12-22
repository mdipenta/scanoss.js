import path from "path";
import { PackageURL } from "packageurl-js";
import { ILocalDependency } from "../DependencyTypes";

const PURL_TYPE = 'npm';


// Parse a package.json file from node projects
// See reference on: https://docs.npmjs.com/cli/v8/configuring-npm/package-json
const MANIFEST_FILE = 'package.json';
export function packageParser(fileContent: string, filePath: string): ILocalDependency {
    // If the file is not manifest file, return an empty results
    const results: ILocalDependency = {file: filePath, purls: []};
    if(path.basename(filePath) != MANIFEST_FILE)
        return results;
    const o = JSON.parse(fileContent);
    let devDeps = Object.keys(o.devDependencies || {});
    let deps = Object.keys(o.dependencies || {});

    for(const name of deps){
        const purlString = new PackageURL(PURL_TYPE, undefined, name, undefined, undefined, undefined).toString();
        results.purls.push({purl: purlString, scope: "dependencies", requirement: o.dependencies[name]});
    }

    for(const name of devDeps){
      const purlString = new PackageURL(PURL_TYPE, undefined, name, undefined, undefined, undefined).toString();
      results.purls.push({purl: purlString, scope: "devDependencies", requirement: o.devDependencies[name]});
    }

    return results;
}


// Parse a package-lock.json file from node projects
// See reference on: https://docs.npmjs.com/cli/v8/configuring-npm/package-json
export function packagelockParser(fileContent: string, filePath: string): ILocalDependency {

    const results: ILocalDependency = {file: filePath, purls: []};

    if(path.basename(filePath) != 'package-lock.json')
        return results;

    const packages = JSON.parse(fileContent)?.packages;

    if(!packages) return results;

    for (const [key, value] of Object.entries(packages)) {
        if(!key) continue;

        const keySplit = key.split("/")
        const depName = keySplit[keySplit.length-1]

        let purl = new PackageURL(PURL_TYPE, undefined, depName,undefined, undefined, undefined).toString();
        let req = value['version'];
        results.purls.push({purl: purl, requirement: req});
    }

    return results;
}



export function yarnLockParser(fileContent: string, filePath: string): ILocalDependency {
  const results: ILocalDependency = {file: filePath, purls: []};

  if(path.basename(filePath) != 'yarn.lock')
    return results;

  const yarnVersion = yarnLockRecognizeVersion(fileContent)
  if (yarnVersion === YarnLockVersionEnum.V1) return yarnLockV1Parser(fileContent, filePath)
  else if (yarnVersion === YarnLockVersionEnum.V2) return yarnLockV2Parser(fileContent, filePath)

  return results;
}

enum YarnLockVersionEnum {
  "V1"  ,
  "V2",
  UnknownYarnLockFormat
}

/*
    The start of v1 file has this:
        # THIS IS AN AUTOGENERATED FILE. DO NOT EDIT THIS FILE DIRECTLY.
        # yarn lockfile v1

    The start of v2 file has this:
        # This file is generated by running "yarn install" inside your project.
        # Manual changes might be lost - proceed with caution!

        __metadata:
 */
export function yarnLockRecognizeVersion(fileContent: string): YarnLockVersionEnum {

  const yarn = fileContent.split("\n", 10) //Check only the first 10 lines;
  for (const line of yarn) {
    if ( line.includes('__metadata:') ) return YarnLockVersionEnum.V2
    if ( line.includes('yarn lockfile v1') ) return YarnLockVersionEnum.V1
  }
  return YarnLockVersionEnum.UnknownYarnLockFormat
}

export function yarnLockV1Parser(fileContent: string, filePath: string): ILocalDependency {

  const results: ILocalDependency = {file: filePath, purls: []};

  //Yield an array with each element is a dependency
  /*
    "@babel/core@^7.1.0", "@babel/core@^7.3.4":
      version "7.3.4"
      resolved "https://registry.yarnpkg.com/@babel/core/-/core-7.3.4.tgz#921a5a13746c21e32445bf0798680e9d11a6530b"
      integrity sha512-jRsuseXBo9pN197KnDwhhaaBzyZr2oIcLHHTt2oDdQrej5Qp57dCCJafWx5ivU8/alEYDpssYqv1MUqcxwQlrA==
      dependencies:
        "@babel/code-frame" "^7.0.0"
        "@babel/generator" "^7.3.4"
   */
  const yl_dependencies = fileContent.split("\n\n");

  for (const yl_dependency of yl_dependencies) {



    const dependencyData: Record<string, string> = {}
    const topRequirements = [];

    const dep_lines = yl_dependency.split("\n");
    if (dep_lines.every((line) =>  line.trim().startsWith("#") == true)) continue //All lines are coments
    if (dep_lines.every((line) =>  line.trim() == "")) continue  //All lines are empty lines

    for (const dep_line of dep_lines) {

      // Clean comments and empty lines
      const trimmed = dep_line.trim();
      const comment = trimmed.startsWith('#');
      if (!trimmed || comment) continue

      // Do nothing with it's own dependencies
      //    "@babel/code-frame" "^7.0.0"
      //    "@babel/generator" "^7.3.4"
      if (dep_line.startsWith(' '.repeat(4))) {}

      //  version "7.3.4"
      //  resolved "https://registry.yarnpkg.com/@babel/core/-/core-7.3.4.tgz#921a5a13746c21e32445bf0798680e9d11a6530b"
      //  integrity sha512-jRsuseXBo9pN197KnDwhhaaBzyZr2oIcLHHTt2oDdQrej5Qp57dCCJafWx5ivU8/alEYDpssYqv1MUqcxwQlrA==
      //  dependencies:
      else if (dep_line.startsWith(' '.repeat(2))) {
        const dep = trimmed.split(" ")
        const key = dep[0].trim();
        if (key !== "dependencies:" && key!=="optionalDependencies:") {
          dependencyData[key] = dep[1].replace(/\"|\'/g, "");
        }
      }

      // the first line of a dependency has the name and requirements
      //"@babel/core@^7.1.0", "@babel/core@^7.3.4":
      else if (!dep_line.startsWith(' ')){
        const dep = dep_line.replace(/:/g, "").split(",");
        const requirements = dep.map(line => line.trim().replace(/"|'/g, ""));

        for (const req of requirements) {

          const atIndex = req.lastIndexOf("@")

          let constraint = req.slice(atIndex+1)  // gets ^7.1.0
          constraint = constraint.replace(/"|'/g, "");

          const ns_name = req.slice(0, atIndex)

          let ns = '';
          let name = ns_name;
          if (ns_name.includes("/")) {
            const slashIndex = req.lastIndexOf("/")
            ns = ns_name.slice(0,slashIndex);
            name = ns_name.slice(slashIndex+1)
          }

          topRequirements.push({constraint: constraint, ns: ns, name: name });
        }

      }


    }

    //Make sure that name and namespace are equal for the same dependency
    const isNsNameEqual = topRequirements.every((topRequirement) => {
      return topRequirement.ns === topRequirements[0].ns && topRequirement.name === topRequirements[0].name
    });

    if (!isNsNameEqual) {
      console.error("Different names for same dependency is not supported")
      continue
    }
    const topRequirement = topRequirements[0];
    const namespace = topRequirement.ns;
    const name = topRequirement.name;
    const version = dependencyData['version'];
    const purl = new PackageURL(PURL_TYPE, namespace, name, version, undefined, undefined).toString()

    let requirement = ''
    for (const topRequirement of topRequirements) {
      requirement += topRequirement.constraint + ", "
    }
    if (requirement.endsWith(", ")) {
      requirement = requirement.slice(0, requirement.length-2)
    }

    results.purls.push({purl: purl, requirement: requirement})

  }


  return results;


}


export function yarnLockV2Parser(fileContent: string, filePath: string): ILocalDependency {

  const results: ILocalDependency = {file: filePath, purls: []};


  return results;

}