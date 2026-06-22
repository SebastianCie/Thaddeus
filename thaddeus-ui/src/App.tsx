import { Routes, Route } from 'react-router-dom'
import { Sidebar } from './components/layout/Sidebar'
import { Dashboard } from './pages/Dashboard'
import { Projects } from './pages/Projects'
import { ProjectDetail } from './pages/ProjectDetail'
import { Deployments } from './pages/Deployments'
import { DeploymentDetail } from './pages/DeploymentDetail'
import { Infrastructure } from './pages/Infrastructure'
import { Library } from './pages/Library'
import { Configuration } from './pages/Configuration'

export default function App() {
  return (
    <div className="layout">
      <Sidebar />
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/projects/:id" element={<ProjectDetail />} />
          <Route path="/deployments" element={<Deployments />} />
          <Route path="/deployments/:id" element={<DeploymentDetail />} />
          <Route path="/infrastructure" element={<Infrastructure />} />
          <Route path="/library" element={<Library />} />
          <Route path="/configuration" element={<Configuration />} />
        </Routes>
      </main>
    </div>
  )
}
