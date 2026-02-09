// add-to-classpath /Users/bmf/Library/Application Support/JetBrains/IntelliJIdea2025.3/plugins/python/lib/python.jar
// add-to-classpath /Users/bmf/Library/Application Support/JetBrains/IntelliJIdea2025.3/plugins/python-ce/lib/python-ce.jar
// depends-on com.jetbrains.python.sdk
// depends-on-plugin PythonCore
// depends-on-plugin Pythonid
// depends-on com.intellij.openai
// depends-on com.intellij.platform.workspace.jps.entities
// depends-on liveplugin.editor
// depends-on com.intellij.openapi.actionSystem.*

import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.projectRoots.ProjectJdkTable
import com.intellij.openapi.projectRoots.Sdk
import com.intellij.openapi.projectRoots.SdkModificator
import com.intellij.openapi.projectRoots.impl.SdkConfigurationUtil
import com.intellij.openapi.roots.ProjectRootManager
import com.jetbrains.python.sdk.PythonSdkType
import liveplugin.registerAction
import liveplugin.show
import java.io.File
import java.nio.file.Paths
import java.nio.file.Files
import java.io.InputStreamReader

if (!isIdeStartup) show("Loading uv-venv plugin")

// Gets the existing python sdk, if it exists.  otherwise returns null
// This specifically ignores the number on the end like (3) to avoid creating duplicates
fun getExistingPythonSdk(pythonExecutablePath: String): Sdk? {
    show("Getting existing PythonSDK")
    val allSdks = ProjectJdkTable.getInstance().getSdksOfType(PythonSdkType.getInstance())
    var match: Sdk? = null
    allSdks.forEach {
        if (it.homePath == pythonExecutablePath) {
            match = it
        }
    }
    return match
}

fun cleanupDuplicates() {
    val allPythonSdks = ProjectJdkTable.getInstance().getSdksOfType(PythonSdkType.getInstance())
    val duplicates: MutableSet<Sdk> = mutableSetOf()
    allPythonSdks.forEach { sdk1: Sdk ->
        val possibleDupes = ProjectJdkTable.getInstance().getSdksOfType(PythonSdkType.getInstance())
        possibleDupes.forEach { sdk2: Sdk ->
            // if the executable path is the same, it's a dupe
            if (sdk1.homePath == sdk2.homePath) {
                duplicates.add(sdk2)
                return@forEach
            }
            // If the name of the sdk is the same, except the '(<number>)' at the end, it's a dupe
            if (sdk1.name.replace(Regex("""\(\d+\)$"""), "") == sdk2.name.replace(Regex("""\(\d+\)$"""), "")) {
                duplicates.add(sdk2)
                return@forEach
            }
        }
    }

    duplicates.forEach {
        com.intellij.openapi.application.ApplicationManager.getApplication().runWriteAction {
            show("Removing duplicate python sdk ${it.name}")
            ProjectJdkTable.getInstance().removeJdk(it)
        }
    }
}

fun getVenvPath(projectPath: String): String? {
    show("Getting venv path")
    try {
        val venvDir = File(projectPath, ".venv")
        if (venvDir.exists() && venvDir.isDirectory) {
            show("Found .venv directory at: ${venvDir.absolutePath}")
            return venvDir.absolutePath
        } else {
            show("No .venv directory found in project root")
            return null
        }
    } catch (e: Exception) { show(e); return null }
}


// Get the sdk name, only if it's a python sdk.  Otherwise return null
fun getPythonSdk(prm: ProjectRootManager): Sdk? {
    show("Getting Python SDK")
    // Get existing sdk, check if its a python sdk
    val projectSdk: Sdk? = prm.getProjectSdk()
    if (projectSdk != null && projectSdk.sdkType is PythonSdkType) {
        return projectSdk
    } else {
        return null
    }
}

fun setupVenv(projectPath: String) {
    show("Setting up venv")
    try {
        val pb = ProcessBuilder("uv", "venv", ".venv")
            .directory(File(projectPath))
            .redirectOutput(ProcessBuilder.Redirect.PIPE)
            .redirectError(ProcessBuilder.Redirect.PIPE)

        val process = pb.start()

        val output = process.inputStream.bufferedReader().readText()
        val error = process.errorStream.bufferedReader().readText()
        process.waitFor()
        val exitCode = process.exitValue()
        if (exitCode != 0) {
            show("'uv venv .venv' failed with output:\n$output\nError:\n$error")
            throw Exception("UV command failed with exit code $exitCode")
        }
        show("'uv venv .venv' exited successfully")
    } catch (e: Exception) {
        show(e)
        show("Failed to create .venv virtual environment using uv.")
    }
}

fun getProperVenvSdkName(venvPath: String): String {
    show("Getting proper venv sdk name")
    // Extract the project name from the venvPath (parent directory of .venv)
    val projectDir = File(venvPath).parentFile
    val projectName = projectDir?.name ?: "unknown"

    // Read the pyvenv.cfg file to extract the Python version
    val pyvenvCfgPath = "${venvPath}/pyvenv.cfg"
    val versionPattern = Regex("""version\s*=\s*(\d+\.\d+)""")
    var pythonVersion: String? = null

    try {
        File(pyvenvCfgPath).forEachLine { line: String ->
            val matchResult = versionPattern.find(line)
            if (matchResult != null) {
                pythonVersion = matchResult.groupValues[1]
                return@forEachLine
            }
        }
    } catch (e: Exception) {
        show("Could not read pyvenv.cfg, using default version")
        pythonVersion = "3.12"
    }

    val version = pythonVersion ?: "3.12"

    // Construct and return the SDK name
    return "Python ${version} (.venv ${projectName})"
}

// This will ensure .venv has been set up for the project, and if not, sets it up
// Returns a string pointing to the path on disk for the venv used by this project
fun ensureVenvConfiguredForProject(projectPath: String): String {
    show("Checking for venv configured")
    var venvPath = getVenvPath(projectPath)
    if (venvPath == null) {
        show("No .venv directory found, running 'uv venv .venv' to create it...")
        setupVenv(projectPath)
        venvPath = getVenvPath(projectPath)
    }
    val pythonExecutable = "${venvPath}/bin/python"
    if (!Files.exists(Paths.get(pythonExecutable))) {
        show(".venv is malformed!  Python executable does not exist but venv path does exist.  Deleting it and creating a new one")
        Files.delete(Paths.get(venvPath))
        setupVenv(projectPath)
        venvPath = getVenvPath(projectPath)
    }

    val forSureVenvPath = requireNotNull(venvPath) { "No venvPath defined even after attempting to setup .venv.  Try to set it up for the project manually" }
    return forSureVenvPath
}

fun fixSdkName(venvPath: String, sdk: Sdk) {
    show("Fixing sdk name")
    val properSdkName: String = getProperVenvSdkName(venvPath)
    show("Setting SDK name to: ${properSdkName}")

    // Update the name. We need to change the actual SDK name in IntelliJ and ensure the changes are persisted
    val sdkModificator: SdkModificator = sdk.getSdkModificator()
    sdkModificator.setName(properSdkName)
    sdkModificator.commitChanges()
}

show("registering action")
registerAction(id = "Add uv python sdk", keyStroke = "ctrl shift A") { e: AnActionEvent ->
    show("inside regster action")
    val project = e.project
    requireNotNull(project) { "ERROR: Could not get project from ActionEvent" }

    val projectPath = project.basePath ?: return@registerAction
    requireNotNull(projectPath) { "ERROR: Could not get project.basePath from IntelliJ project" }

    val prm = ProjectRootManager.getInstance(project)

    // Return early if we already have a python sdk set for the project
    // TODO: also check validity of sdk
    val projectPythonSdk = getPythonSdk(prm)
    if (projectPythonSdk != null) {
        show("Project SDK is already set to a valid Python SDK: ${projectPythonSdk.name}")
        return@registerAction
    }

    // Now we know we do not have a python sdk set

    // Ensure .venv is configured for the project, and get the venv path
    val venvPath = ensureVenvConfiguredForProject(projectPath)
    requireNotNull(venvPath) { "ERROR: Failed to create .venv virtual environment." }

    // Now we know we have .venv set up, and we have the path in venvPath

    val pythonExecutable = "${venvPath}/bin/python"
    var sdk = getExistingPythonSdk(pythonExecutable)
    if (sdk != null) {
        show("Python SDK already exists: ${sdk.name}")
    } else {
        show("Attempting to create python SDK w/ executable: ${pythonExecutable}")
        val createdSdk = SdkConfigurationUtil.createAndAddSDK(pythonExecutable, PythonSdkType.getInstance())
        requireNotNull(createdSdk) { "ERROR: Failed to configure Python SDK." }

        show("Created new Python SDK: ${createdSdk.name}")
        sdk = createdSdk
    }

    com.intellij.openapi.application.ApplicationManager.getApplication().runWriteAction {
        fixSdkName(venvPath, sdk)
        // Always set the project SDK to the found or created SDK (MUST be in write action)
        prm.setProjectSdk(sdk)
    }
    show("Set project SDK to: ${sdk.name}")
}
