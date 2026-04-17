import sys
import argparse
import grpc
import base64

try:
    import riva.client
except ImportError:
    print("ERROR: nvidia-riva-client not installed. Run: pip install nvidia-riva-client", file=sys.stderr)
    sys.exit(1)

def main():
    parser = argparse.ArgumentParser(description="NVIDIA NIM Riva TTS Bridge")
    parser.add_argument("--server", default="grpc.nvcf.nvidia.com:443")
    parser.add_argument("--use-ssl", action="store_true", default=True)
    parser.add_argument("--function-id", required=True)
    parser.add_argument("--api-key", required=True)
    parser.add_argument("--language-code", required=True)
    parser.add_argument("--voice", required=True)
    parser.add_argument("--text", required=True)
    
    args = parser.parse_args()

    # Setup NVCF gRPC authentication
    auth = riva.client.Auth(
        use_ssl=args.use_ssl,
        uri=args.server,
        metadata_args=[
            ("function-id", args.function_id),
            ("authorization", f"Bearer {args.api_key}"),
        ]
    )

    # Initialize Speech Synthesis Client
    tts_client = riva.client.SpeechSynthesisService(auth)
    
    try:
        # Perform synthesis (offline/batch mode)
        response = tts_client.synthesize(
            text=args.text,
            voice_name=args.voice,
            language_code=args.language_code,
            sample_rate_hz=44100
        )
        
        # Audio bytes returned from standard synthesize
        audio_bytes = response.audio
        # Output base64 to stdout so Node can read it easily
        b64_out = base64.b64encode(audio_bytes).decode('utf-8')
        print(b64_out)
        
    except grpc.RpcError as e:
        print(f"ERROR: gRPC Call failed: {e.details()}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"ERROR: {str(e)}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
