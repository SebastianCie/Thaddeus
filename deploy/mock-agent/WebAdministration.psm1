# Mock WebAdministration module — simulates IIS on Linux/macOS for Thaddeus agent testing.
# Every cmdlet logs what it would do on a real Windows/IIS machine and returns plausible objects.

function Test-Path {
    param(
        [Parameter(Position = 0)] [string] $Path,
        [switch] $IsValid,
        [string] $PathType
    )
    if ($Path -like "IIS:\*") {
        Write-Host "[MOCK-IIS] Test-Path '$Path' -> `$false  (simulated: path does not exist yet)"
        return $false
    }
    Microsoft.PowerShell.Management\Test-Path @PSBoundParameters
}

function New-WebAppPool {
    param([string] $Name)
    Write-Host "[MOCK-IIS] New-WebAppPool: creating application pool '$Name'"
    return [PSCustomObject]@{ Name = $Name; State = "Started"; managedRuntimeVersion = "v4.0"; startMode = "OnDemand" }
}

function Set-ItemProperty {
    param(
        [Parameter(Position = 0)] [string] $Path,
        [string] $Name,
        $Value
    )
    if ($Path -like "IIS:\*") {
        Write-Host "[MOCK-IIS] Set-ItemProperty '$Path' -Name '$Name' -Value '$Value'"
        return
    }
    Microsoft.PowerShell.Management\Set-ItemProperty @PSBoundParameters
}

function Get-Website {
    param([string] $Name, [string] $ErrorAction)
    if ($Name) {
        Write-Host "[MOCK-IIS] Get-Website -Name '$Name' -> returning mock site (State: Started)"
        return [PSCustomObject]@{ Name = $Name; State = "Started"; PhysicalPath = "C:\inetpub\$Name"; ApplicationPool = "${Name}Pool" }
    }
    Write-Host "[MOCK-IIS] Get-Website -> returning empty list"
    return @()
}

function New-Website {
    param([string] $Name, [string] $PhysicalPath, [string] $ApplicationPool, [switch] $Force)
    Write-Host "[MOCK-IIS] New-Website: site='$Name' path='$PhysicalPath' pool='$ApplicationPool'"
    return [PSCustomObject]@{ Name = $Name; State = "Stopped"; PhysicalPath = $PhysicalPath; ApplicationPool = $ApplicationPool }
}

function Stop-Website {
    param([string] $Name)
    Write-Host "[MOCK-IIS] Stop-Website: stopping '$Name'"
}

function Start-Website {
    param([string] $Name)
    Write-Host "[MOCK-IIS] Start-Website: starting '$Name'"
}

function Get-WebApplication {
    param([string] $Name, [string] $Site, [string] $ErrorAction)
    Write-Host "[MOCK-IIS] Get-WebApplication -Name '$Name' -Site '$Site' -> `$null  (not deployed yet)"
    return $null
}

function New-WebApplication {
    param([string] $Name, [string] $Site, [string] $PhysicalPath, [string] $ApplicationPool)
    Write-Host "[MOCK-IIS] New-WebApplication: site='$Site' path='/$Name' physicalPath='$PhysicalPath' pool='$ApplicationPool'"
    return [PSCustomObject]@{ Name = $Name; Site = $Site; PhysicalPath = $PhysicalPath; ApplicationPool = $ApplicationPool; State = "Started" }
}

function Set-WebConfigurationProperty {
    param([string] $Filter, [string] $Name, $Value)
    Write-Host "[MOCK-IIS] Set-WebConfigurationProperty -Filter '$Filter' -Name '$Name' -Value '$Value'"
}

Export-ModuleMember -Function Test-Path, New-WebAppPool, Set-ItemProperty, Get-Website, New-Website, Stop-Website, Start-Website, Get-WebApplication, New-WebApplication, Set-WebConfigurationProperty
