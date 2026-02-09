import com.intellij.openapi.editor.Editor
import com.intellij.openapi.editor.EditorFactory
import com.intellij.openapi.editor.Document
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.actionSystem.CommonDataKeys
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.diagnostic.Logger // Import Logger
import liveplugin.registerAction

val logger = Logger.getInstance("SurroundWithDollarPlugin")
registerAction(id = "SurroundWithDollar", keyStroke = "ctrl shift C", actionGroupId = "ToolsMenu") { actionEvent: AnActionEvent ->
    logger.info("Action triggered") // Log when the action is triggered

    val editor = actionEvent.getData(CommonDataKeys.EDITOR)
    if (editor == null) {
        logger.warn("Editor not found") // Log if editor is not found
        return@registerAction
    }

    val document = editor.document
    val selectionModel = editor.selectionModel

    val start = selectionModel.selectionStart
    val end = selectionModel.selectionEnd
    val selectedText = selectionModel.selectedText
    if (selectedText == null) {
        logger.warn("No text selected") // Log if no text is selected
        return@registerAction
    }

    logger.info("Selected text: $selectedText") // Log the selected text

    ApplicationManager.getApplication().runWriteAction {
        document.replaceString(start, end, "\$${selectedText}\$")
        logger.info("Replaced text with: \$${selectedText}\$") // Log the replacement
    }

    // Optionally deselect
    selectionModel.removeSelection()
    logger.info("Selection removed") // Log after removing selection
}
