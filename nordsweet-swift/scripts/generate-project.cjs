const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),projectDir=path.join(root,'Nordsweet.xcodeproj');
const id=s=>crypto.createHash('sha1').update(s).digest('hex').slice(0,24).toUpperCase();
const q=s=>JSON.stringify(s), objects=[];
const add=(key,body)=>{objects.push(`${id(key)} = { ${body} };`);return id(key)};
function walk(dir){return fs.readdirSync(path.join(root,dir),{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(dir+'/'+e.name):[dir+'/'+e.name]);}
const sources=walk('Nordsweet').filter(p=>p.endsWith('.swift'));
const sourceRefs=sources.map(p=>add('ref:'+p,`isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = ${q(p)}; sourceTree = SOURCE_ROOT;`));
const sourceBuilds=sources.map(p=>add('build:'+p,`isa = PBXBuildFile; fileRef = ${id('ref:'+p)};`));
const resources=['Nordsweet/Assets.xcassets','Nordsweet/PrivacyInfo.xcprivacy'];
const resourceRefs=resources.map(p=>add('ref:'+p,`isa = PBXFileReference; lastKnownFileType = ${p.endsWith('xcassets')?'folder.assetcatalog':'text.xml'}; path = ${q(p)}; sourceTree = SOURCE_ROOT;`));
const resourceBuilds=resources.map(p=>add('build:'+p,`isa = PBXBuildFile; fileRef = ${id('ref:'+p)};`));
add('app',`isa = PBXFileReference; explicitFileType = wrapper.application; path = Nordsweet.app; sourceTree = BUILT_PRODUCTS_DIR;`);
add('products',`isa = PBXGroup; children = (${id('app')},); name = Products; sourceTree = "<group>";`);
add('group',`isa = PBXGroup; children = (${[...sourceRefs,...resourceRefs,id('products')].join(',')},); sourceTree = "<group>";`);
add('sources',`isa = PBXSourcesBuildPhase; buildActionMask = 2147483647; files = (${sourceBuilds.join(',')},); runOnlyForDeploymentPostprocessing = 0;`);
add('resources',`isa = PBXResourcesBuildPhase; buildActionMask = 2147483647; files = (${resourceBuilds.join(',')},); runOnlyForDeploymentPostprocessing = 0;`);
add('package',`isa = XCLocalSwiftPackageReference; relativePath = Packages/NordsweetCore;`);
add('library',`isa = XCSwiftPackageProductDependency; package = ${id('package')}; productName = NordsweetCore;`);
add('library-build',`isa = PBXBuildFile; productRef = ${id('library')};`);
add('frameworks',`isa = PBXFrameworksBuildPhase; buildActionMask = 2147483647; files = (${id('library-build')},); runOnlyForDeploymentPostprocessing = 0;`);
for(const mode of ['Debug','Release']) {
add('project-'+mode,`isa = XCBuildConfiguration; name = ${mode}; buildSettings = { CLANG_ENABLE_MODULES = YES; SDKROOT = iphoneos; IPHONEOS_DEPLOYMENT_TARGET = 17.0; SWIFT_VERSION = 5.0; SWIFT_OPTIMIZATION_LEVEL = ${q(mode==='Debug'?'-Onone':'-O')}; ${mode==='Debug'?'ENABLE_TESTABILITY = YES; SWIFT_ACTIVE_COMPILATION_CONDITIONS = DEBUG;':'SWIFT_COMPILATION_MODE = wholemodule;'} };`);
add('target-'+mode,`isa = XCBuildConfiguration; name = ${mode}; buildSettings = { ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon; CODE_SIGN_STYLE = Automatic; CURRENT_PROJECT_VERSION = 2; GENERATE_INFOPLIST_FILE = NO; INFOPLIST_FILE = Nordsweet/Info.plist; IPHONEOS_DEPLOYMENT_TARGET = 17.0; LD_RUNPATH_SEARCH_PATHS = ("$(inherited)","@executable_path/Frameworks",); MARKETING_VERSION = 0.2.0; PRODUCT_BUNDLE_IDENTIFIER = com.nordsweet.performance; PRODUCT_NAME = "$(TARGET_NAME)"; SWIFT_VERSION = 5.0; TARGETED_DEVICE_FAMILY = "1,2"; SUPPORTED_PLATFORMS = "iphoneos iphonesimulator"; SUPPORTS_MACCATALYST = NO; };`);
}
for(const kind of ['project','target'])add(kind+'-configs',`isa = XCConfigurationList; buildConfigurations = (${id(kind+'-Debug')},${id(kind+'-Release')},); defaultConfigurationIsVisible = 0; defaultConfigurationName = Release;`);
add('target',`isa = PBXNativeTarget; buildConfigurationList = ${id('target-configs')}; buildPhases = (${id('sources')},${id('frameworks')},${id('resources')},); buildRules = (); dependencies = (); name = Nordsweet; packageProductDependencies = (${id('library')},); productName = Nordsweet; productReference = ${id('app')}; productType = "com.apple.product-type.application";`);
add('project',`isa = PBXProject; attributes = { BuildIndependentTargetsInParallel = YES; LastUpgradeCheck = 2600; TargetAttributes = { ${id('target')} = { CreatedOnToolsVersion = 26.0; ProvisioningStyle = Automatic; }; }; }; buildConfigurationList = ${id('project-configs')}; compatibilityVersion = "Xcode 14.0"; developmentRegion = pl; hasScannedForEncodings = 0; knownRegions = (pl,en,Base,); mainGroup = ${id('group')}; packageReferences = (${id('package')},); productRefGroup = ${id('products')}; projectDirPath = ""; projectRoot = ""; targets = (${id('target')},);`);
fs.mkdirSync(path.join(projectDir,'xcshareddata/xcschemes'),{recursive:true});
fs.writeFileSync(path.join(projectDir,'project.pbxproj'),`// !$*UTF8*$!\n{ archiveVersion = 1; classes = {}; objectVersion = 60; objects = {\n${objects.join('\n')}\n}; rootObject = ${id('project')}; }\n`);
const ref=`<BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="${id('target')}" BuildableName="Nordsweet.app" BlueprintName="Nordsweet" ReferencedContainer="container:Nordsweet.xcodeproj"/>`;
fs.writeFileSync(path.join(projectDir,'xcshareddata/xcschemes/Nordsweet.xcscheme'),`<?xml version="1.0" encoding="UTF-8"?><Scheme LastUpgradeVersion="2600" version="1.3"><BuildAction parallelizeBuildables="YES" buildImplicitDependencies="YES"><BuildActionEntries><BuildActionEntry buildForTesting="YES" buildForRunning="YES" buildForProfiling="YES" buildForArchiving="YES" buildForAnalyzing="YES">${ref}</BuildActionEntry></BuildActionEntries></BuildAction><TestAction buildConfiguration="Debug"/><LaunchAction buildConfiguration="Debug" selectedDebuggerIdentifier="Xcode.DebuggerFoundation.Debugger.LLDB" selectedLauncherIdentifier="Xcode.IDEFoundation.Launcher.LLDB" launchStyle="0" useCustomWorkingDirectory="NO" ignoresPersistentStateOnLaunch="NO" debugDocumentVersioning="YES" allowLocationSimulation="YES"><BuildableProductRunnable runnableDebuggingMode="0">${ref}</BuildableProductRunnable></LaunchAction><ProfileAction buildConfiguration="Release"><BuildableProductRunnable runnableDebuggingMode="0">${ref}</BuildableProductRunnable></ProfileAction><AnalyzeAction buildConfiguration="Debug"/><ArchiveAction buildConfiguration="Release" revealArchiveInOrganizer="YES"/></Scheme>`);
console.log('Generated Nordsweet.xcodeproj with '+sources.length+' SwiftUI source files and local Swift core package.');
