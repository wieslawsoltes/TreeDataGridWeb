# Blazor publication and recovery

The build-source pin includes the bounded NuGet download verifier and its 14 offline regression tests. Component runtime APIs and already-published package versions are unchanged.

After a successful upload, verification waits up to 720 seconds for public availability. It retries missing downloads, transient network failures, rate limits and selected server errors; permanent errors and downloaded payload conflicts remain fatal. NUGET_VERIFY_TIMEOUT_SECONDS or --timeout-seconds overrides the wait budget. Increase the publish job timeout as well when requesting a longer wait.

When an upload succeeds but verification times out, rerun only the failed **publish** job from the original Actions run. Its validated artifacts are reused; matching existing packages are verified, not rebuilt or replaced. A release is created only after public payload verification. Assemblies, static assets and the nuspec must match; only NuGet's repository-signature member is excluded.

Version.props versions NuGet independently of npm. Change it for a new release; never overwrite an existing immutable version. See [README.md](README.md) and [INTEGRATION.md](INTEGRATION.md) for building and hosting consumers.
