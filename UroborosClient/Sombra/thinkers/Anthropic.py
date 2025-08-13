def sombra_mind_state(promptString, AnthropicClient):
    # prompt = ''
    with open('Sombra/prompts/sombraCurriculum.md', 'r') as promptFile:
        prompt = promptFile.read()

    print('[SOMBRA] Calling Anthropic backend')

    response = AnthropicClient.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1000,
        temperature=1,
        system=prompt,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": promptString
                    }
                ]
            }
        ]
    )

    return response.content[0].text

def executive_function(promptString, AnthropicClient):
    # prompt = ''
    with open('Sombra/prompts/Puppeteer.md', 'r') as promptFile:
        prompt = promptFile.read()

    generatedMindState = sombra_mind_state(promptString, AnthropicClient)

    stateStart = promptString.find('Bioma:')
    stateString = '\n'.join(promptString[stateStart:].splitlines()[:-2])

    t = stateString + '\n' + generatedMindState
    generatedMindState = "".join([s for s in t.strip().splitlines(True) if s.strip()])

    print('[GULLIVER] Calling Anthropic backend')

    response = AnthropicClient.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1000,
        temperature=1,
        system=prompt,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": generatedMindState
                    }
                ]
            }
        ]
    )

    instructions = response.content[0].text

    reason_start = generatedMindState.find('Razonamiento')
    return '\n'.join(generatedMindState[reason_start:].splitlines()[0:]), instructions


def call_ego(promptString, AnthropicClient):
    # prompt = ''
    with open('Sombra/prompts/anyInABottle.md', 'r') as promptFile:
        prompt = promptFile.read()

    print('[EGO] Calling Anthropic backend')

    response = AnthropicClient.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1000,
        temperature=1,
        system=prompt,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": promptString
                    }
                ]
            }
        ]
    )

    anyChat = response.content[0].text
    return anyChat
