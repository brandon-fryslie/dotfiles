import com.intellij.codeInsight.TargetElementEvaluator
import com.intellij.codeInsight.TargetElementUtilBase
import com.intellij.codeInsight.daemon.DaemonCodeAnalyzer
import com.intellij.lang.Language
import com.intellij.lang.LanguageExtension
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.module.ModuleManager
import com.intellij.openapi.progress.ProgressIndicator
import com.intellij.openapi.project.Project
import com.intellij.openapi.roots.ModifiableRootModel
import com.intellij.openapi.roots.ModuleRootManager
import com.intellij.openapi.roots.OrderRootType
import com.intellij.openapi.roots.ProjectRootManager
import com.intellij.openapi.roots.libraries.LibraryTablesRegistrar
import com.intellij.openapi.vfs.VirtualFile
import com.intellij.openapi.vfs.VirtualFileManager
import com.intellij.psi.FileResolveScopeProvider
import com.intellij.psi.JavaRecursiveElementVisitor
import com.intellij.psi.JavaResolveResult
import com.intellij.psi.PsiClass
import com.intellij.psi.PsiDocumentManager
import com.intellij.psi.PsiElement
import com.intellij.psi.PsiFile
import com.intellij.psi.PsiFileSystemItem
import com.intellij.psi.PsiImportList
import com.intellij.psi.PsiImportStatementBase
import com.intellij.psi.PsiJavaCodeReferenceElement
import com.intellij.psi.PsiPolyVariantReference
import com.intellij.psi.PsiReference
import com.intellij.psi.PsiReferenceExpression
import com.intellij.psi.ResolveResult
import com.intellij.psi.ResolveScopeEnlarger
import com.intellij.psi.ResolveScopeProvider
import com.intellij.psi.impl.PsiManagerEx
import com.intellij.psi.impl.source.PsiJavaCodeReferenceElementImpl
import com.intellij.psi.impl.source.resolve.FileContextUtil
import com.intellij.psi.impl.source.resolve.ResolveCache
import com.intellij.psi.impl.source.tree.FileElement
import com.intellij.psi.impl.source.tree.SharedImplUtil
import com.intellij.psi.impl.source.tree.java.PsiReferenceExpressionImpl
import com.intellij.psi.search.GlobalSearchScope
import com.intellij.psi.search.searches.DefinitionsScopedSearch
import com.intellij.util.Processor
import org.jetbrains.annotations.NotNull

import static com.intellij.psi.impl.source.tree.java.PsiReferenceExpressionImpl.OurGenericsResolver.*
import static liveplugin.PluginUtil.*

registerAction("FindAllJavaClassDependencies", "alt shift D", TOOLS_MENU, "Find All Dependencies") { AnActionEvent event ->
    def project = event.project
    def document = currentDocumentIn(project)
    def psiFile = PsiDocumentManager.getInstance(project).getPsiFile(document)

    doInBackground("Looking for dependencies of ${psiFile.name}") { ProgressIndicator indicator ->
        def dependencies = allProjectDependenciesOf(psiFile, project, indicator)
        show(dependencies.collect{ it.virtualFile.path }.join("\n"))
    }
}
if (!isIdeStartup) show("reloaded")


Set<PsiFileSystemItem> allProjectDependenciesOf(PsiFileSystemItem psiItem, Project project, ProgressIndicator indicator) {
    def fileIndex = ProjectRootManager.getInstance(project).fileIndex
    def isInProject = { PsiFileSystemItem item ->
        item?.virtualFile != null && fileIndex.isInSource(item.virtualFile) && !fileIndex.isInLibrarySource(item.virtualFile)
    }

    def visited = new HashSet()
    def queue = [psiItem]

    while (!queue.empty) {
        if (indicator.canceled) return

        def item = queue.remove(0)
        visited.add(item)

        Set<PsiFileSystemItem> dependencies = runReadAction { dependenciesOf(item) }
        dependencies.removeAll(visited)
        dependencies = dependencies.findAll{ isInProject(it) }

        queue.addAll(dependencies)
    }
    visited.remove(psiItem)
    visited
}

Set<PsiFileSystemItem> dependenciesOf(PsiFileSystemItem item) {
    def dependencies = new HashSet()
    item.acceptChildren(new JavaRecursiveElementVisitor() {
        @Override void visitReferenceElement(PsiJavaCodeReferenceElement reference) {
            def element = reference.resolve()
            if (element == null) {
                show("NOT resolved for " + reference)
                return
            }
            def psiFileItem = rootPsiOf(element)
            dependencies.add(psiFileItem)
        }

        @Override void visitImportList(PsiImportList list) {
            for (statement in list.importStatements) {
                def psiFileItem = rootPsiOf(statement.importReference.element)
                dependencies.add(psiFileItem)
            }
            for (statement in list.importStaticStatements) {
                def psiFileItem = rootPsiOf(statement.importReference.element)
                dependencies.add(psiFileItem)
            }
        }
    })
    dependencies.remove(item)
    dependencies.remove(null)
    dependencies
}

PsiFileSystemItem rootPsiOf(PsiElement element) {
    if (element == null) null
    else if (element instanceof PsiFileSystemItem) element
    else rootPsiOf(element.parent)
}
