import fs from 'fs'
import {
  pomParser
} from '../../src/lib/dependencies/LocalDependency/parsers/mavenParser';
import { ILocalDependency } from '../../src/lib/dependencies/LocalDependency/DependencyTypes'
import { expect } from 'chai';

describe('Suit test for Pom parser', function() {

  it('Testing valids pom.xml', function (){
    const tests: [{
      inputPath: string;
      expectedResult: ILocalDependency;
    }] = [{
      inputPath: "./tests/data/dependencies/pom.xml/2/pom.xml",
      expectedResult: {file: 'pom.xml', purls: [
          {purl: "pkg:maven/org.keycloak/keycloak-dependencies-admin-ui-wrapper?type=pom", requirement: "999-SNAPSHOT", scope: null},
          {purl: "pkg:maven/org.jboss/jboss-dmr", requirement: "1.5.1.Final", scope: null},
          {purl: "pkg:maven/com.sun.istack/istack-commons-runtime", requirement: "3.0.10", scope: null},
          {purl: "pkg:maven/org.wildfly.common/wildfly-common", requirement: "1.6.0.Final", scope: null},
          {purl: "pkg:maven/org.keycloak/keycloak-testsuite-utils", requirement: "999-SNAPSHOT", scope: null},
          {purl: "pkg:maven/org.keycloak/keycloak-testsuite-tools", requirement: "999-SNAPSHOT", scope: null},
          {purl: "pkg:maven/org.keycloak/keycloak-testsuite-tools?classifier=classes", requirement: "999-SNAPSHOT", scope: null},
          {purl: "pkg:maven/org.eclipse.microprofile.metrics/microprofile-metrics-api", requirement: "2.3", scope: null},
          {purl: "pkg:maven/org.keycloak/keycloak-server-galleon-pack?type=zip", requirement: "999-SNAPSHOT", scope: null},
          {purl: "pkg:maven/org.keycloak/keycloak-server-galleon-pack?type=pom", requirement: "999-SNAPSHOT", scope: null},
          {purl: "pkg:maven/org.wildfly.galleon-plugins/wildfly-galleon-plugins", requirement: "5.2.7.Final", scope: null},
          {purl: "pkg:maven/org.wildfly.galleon-plugins/wildfly-config-gen", requirement: "5.2.7.Final", scope: null},
          {purl: "pkg:maven/org.wildfly.galleon-plugins/transformer", requirement: "5.2.7.Final", scope: null},
          {purl: "pkg:maven/org.wildfly.core/wildfly-embedded", requirement: "18.1.0.Final", scope: null}
        ]}
    }];

    for (const test of tests) {
      const fileContent = fs.readFileSync(test.inputPath,  {encoding:'utf-8'});
      const result = pomParser(fileContent, 'pom.xml');
      expect(test.expectedResult).to.deep.equal(result)
    }
  });

});