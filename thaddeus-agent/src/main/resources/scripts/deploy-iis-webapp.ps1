# Thaddeus Agent - Deploy IIS Web Application
# {{PARENT_SITE}}, {{VIRTUAL_PATH}}, {{PHYSICAL_PATH}}, {{APP_POOL_NAME}}

$ParentSite   = "{{PARENT_SITE}}"
$VirtualPath  = "{{VIRTUAL_PATH}}"
$PhysicalPath = "{{PHYSICAL_PATH}}"
$AppPoolName  = "{{APP_POOL_NAME}}"

Import-Module WebAdministration -ErrorAction Stop

# Verify parent site exists
if (-not (Get-Website -Name $ParentSite -ErrorAction SilentlyContinue)) {
    throw "Parent site '$ParentSite' does not exist on this server"
}

Write-Host "--- Configuring Application Pool: $AppPoolName ---"
if (-not (Test-Path "IIS:\AppPools\$AppPoolName")) {
    New-WebAppPool -Name $AppPoolName
    Write-Host "Created App Pool: $AppPoolName"
}

$fullPath = "$ParentSite$VirtualPath"
Write-Host "--- Configuring Web Application: $fullPath ---"

if (Get-WebApplication -Site $ParentSite -Name $VirtualPath.TrimStart('/') -ErrorAction SilentlyContinue) {
    Write-Host "Updating existing web application"
    Set-WebConfigurationProperty -Filter "/system.applicationHost/sites/site[@name='$ParentSite']/application[@path='$VirtualPath']" `
        -Name "physicalPath" -Value $PhysicalPath
} else {
    Write-Host "Creating new web application"
    New-WebApplication -Name $VirtualPath.TrimStart('/') -Site $ParentSite `
        -PhysicalPath $PhysicalPath -ApplicationPool $AppPoolName
}

Write-Host "IIS Web Application deployment successful."
