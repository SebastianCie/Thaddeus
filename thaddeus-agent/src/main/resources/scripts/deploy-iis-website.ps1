# Thaddeus Agent - Deploy IIS Website
# Parameters injected via template substitution
# {{SITE_NAME}}, {{APP_POOL_NAME}}, {{PHYSICAL_PATH}}, {{DOTNET_VERSION}}

$SiteName      = "{{SITE_NAME}}"
$AppPoolName   = "{{APP_POOL_NAME}}"
$PhysicalPath  = "{{PHYSICAL_PATH}}"
$DotNetVersion = "{{DOTNET_VERSION}}"

Import-Module WebAdministration -ErrorAction Stop

Write-Host "--- Configuring Application Pool: $AppPoolName ---"
if (-not (Test-Path "IIS:\AppPools\$AppPoolName")) {
    New-WebAppPool -Name $AppPoolName
    Write-Host "Created App Pool: $AppPoolName"
}
Set-ItemProperty "IIS:\AppPools\$AppPoolName" -Name managedRuntimeVersion -Value $DotNetVersion
Set-ItemProperty "IIS:\AppPools\$AppPoolName" -Name startMode -Value "AlwaysRunning"

Write-Host "--- Configuring IIS Site: $SiteName ---"
if (Get-Website -Name $SiteName -ErrorAction SilentlyContinue) {
    Write-Host "Stopping existing site: $SiteName"
    Stop-Website -Name $SiteName
    Write-Host "Updating physical path to: $PhysicalPath"
    Set-ItemProperty "IIS:\Sites\$SiteName" -Name physicalPath -Value $PhysicalPath
} else {
    Write-Host "Creating new site: $SiteName"
    New-Website -Name $SiteName -PhysicalPath $PhysicalPath -ApplicationPool $AppPoolName -Force
}

Set-ItemProperty "IIS:\Sites\$SiteName" -Name applicationPool -Value $AppPoolName

Write-Host "Starting site: $SiteName"
Start-Website -Name $SiteName

$state = (Get-Website -Name $SiteName).State
Write-Host "Site state: $state"
if ($state -ne "Started") {
    throw "Site '$SiteName' failed to start (state: $state)"
}

Write-Host "IIS Website deployment successful."
